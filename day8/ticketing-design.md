# TicketHub: Ticketing System Design

## 1. Requirements

### Functional requirements

- Visitors can browse and search events by artist, venue, city, date, and category.
- Visitors can view an event's seat map, seat labels, prices, and current availability.
- Signed-in users can temporarily hold available seats, with a clear expiry time.
- Users can pay for an active order and receive confirmed tickets only after payment is verified.
- Users can view their upcoming and past tickets, order details, and payment status.
- Users can cancel or request refunds where the event's policy allows it.
- Organizers can create events, configure seats and prices, and monitor sales.
- The system sends order confirmations and releases expired or abandoned holds.

### Non-functional requirements

- **Speed:** event listings and seat maps should normally load within 2 seconds at the 95th percentile; a hold attempt should normally respond within 1 second at the 95th percentile, excluding external payment-provider time.
- **Correctness:** a seat must never be sold to two orders. Ticket issuance, seat state, and order state must be committed consistently. Payment callbacks must be verified and processed idempotently.
- **Fairness:** a virtual waiting room should control entry during a high-demand sale. At the published opening time, issue queue tokens using a documented, auditable policy (for example, randomized ordering of users already waiting at opening, followed by FIFO). Do not let repeated refreshes or parallel requests improve a user's position. Enforce per-account and per-payment limits.
- **Availability:** browsing may remain available during partial failures; seat holds and checkout must fail safely rather than risk selling the same seat twice.
- **Scalability:** the stateless API tier can scale horizontally, while sale-specific queues and rate limits absorb sudden demand.
- **Security and privacy:** require authentication for holds, orders, and tickets; authorize every order against its owner; use HTTPS, rate limiting, bot detection, and a PCI-compliant payment provider. Never store raw card numbers or security codes.
- **Durability and recovery:** back up order and ticket data, monitor database replication, and test recovery procedures.
- **Accessibility and clarity:** seat states and queue progress must not rely on color alone; tell users when a hold expires or seats become unavailable.

## 2. Traffic estimates

These estimates use only the supplied figures. Since the normal day's hourly distribution is unknown, average rates are calculated across 24 hours; the big-sale rate is calculated across its first 10 minutes. Page views are not the same as API requests, so the page-view estimate is a baseline rather than a complete request forecast.

### Normal day

- Registered users: **2,000,000**.
- Daily visitors: **50,000**.
- Page views: 50,000 visitors × 10 pages = **500,000 page views/day**.
- Average page-view rate: 500,000 ÷ 86,400 seconds = **5.8 page views/second**.
- Tickets sold: **5,000/day**, equivalent to about **0.058 tickets/second** averaged over 24 hours.
- If one page view causes 3–5 API calls, the rough average API rate is **17–29 requests/second**. Real peaks will be higher and should be measured from analytics.

### Popular concert sale

- Interested buyers: **200,000 people in 10 minutes**.
- Seat inventory: **20,000 seats**.
- Average incoming purchase attempts: 200,000 ÷ 600 seconds = **333 attempts/second**.
- Seats available for sale per second over that window: 20,000 ÷ 600 = **33.3 seats/second** on average.
- Demand is **10 buyers per available seat**. At most 20,000 tickets can be sold, so at least 180,000 attempts cannot result in a ticket for this event.
- If each buyer loads a seat map and makes 3–5 related API calls, the burst can generate roughly **1,000–1,700 API requests/second**, before retries and static asset traffic. This is a planning scenario, not a measured rate.

### Comparison and implications

The incoming purchase-attempt rate alone is about **57 times** the normal average page-view rate (333 ÷ 5.8). The estimated API burst can be well over 50 times normal average API traffic. The system should therefore cache read-only event information, isolate the seat-hold path from browsing traffic, use a waiting room, and protect the database with bounded concurrency. Do not use a cache as the final authority for seat availability.

## 3. API design

Base path: /api/v1. Use JSON over HTTPS. Authenticated routes require a bearer token. Responses should include a request ID for support and tracing.

| Method and endpoint | Purpose | Success response |
| --- | --- | --- |
| GET /events?query=&date=&city=&cursor= | Search and paginate event listings | 200 OK |
| GET /events/{eventId} | View event details, venue, sale time, and policies | 200 OK |
| GET /events/{eventId}/seats | Get seat labels, prices, and current states; state is advisory until a hold succeeds | 200 OK |
| POST /holds | Atomically hold one or more seats for the current user for a short period, e.g. 5 minutes | 201 Created |
| GET /holds/{holdId} | Check hold state and expiry | 200 OK |
| POST /orders/{orderId}/pay | Start or confirm payment for an order using a payment-provider payment intent | 202 Accepted or 200 OK |
| GET /me/tickets | List the signed-in user's confirmed tickets | 200 OK |
| GET /orders/{orderId} | View an order owned by the signed-in user | 200 OK |
| DELETE /holds/{holdId} | Release an active hold before expiry | 204 No Content |

### Example: hold seats

Request:

    POST /api/v1/holds
    Authorization: Bearer <access-token>
    Idempotency-Key: 9f4c...unique-client-key
    Content-Type: application/json

    {
      "eventId": "evt_204",
      "seatIds": ["seat_A12", "seat_A13"]
    }

Successful response (201 Created):

    {
      "holdId": "hold_781",
      "eventId": "evt_204",
      "seatIds": ["seat_A12", "seat_A13"],
      "status": "HELD",
      "expiresAt": "2026-10-28T17:15:00Z"
    }

If any requested seat is already sold or actively held, the service should return 409 Conflict and explain which seats could not be held. For multi-seat requests, hold all requested seats atomically or hold none; do not leave a partial hold unless the API explicitly documents that behavior.

### Example: pay for an order

Request:

    POST /api/v1/orders/ord_781/pay
    Authorization: Bearer <access-token>
    Idempotency-Key: pay-ord_781-attempt-1
    Content-Type: application/json

    {
      "paymentMethodToken": "provider-token-from-secure-client-flow"
    }

Response (202 Accepted):

    {
      "orderId": "ord_781",
      "status": "PAYMENT_PENDING",
      "message": "Payment is being confirmed."
    }

The payment provider's signed webhook is the authoritative confirmation of payment. After a verified success, the service marks the order paid and issues tickets in a database transaction. Repeated requests or webhook deliveries must not create duplicate charges or tickets.

### Other important errors

- 400 Bad Request — invalid seat IDs, invalid event, or malformed input.
- 401 Unauthorized — missing or expired login.
- 403 Forbidden — user is not allowed to view or change this order.
- 404 Not Found — event, seat, hold, or order does not exist.
- 409 Conflict — seat already held/sold, hold expired, or order is not payable.
- 429 Too Many Requests — queue or rate limit reached; include Retry-After where appropriate.
- 503 Service Unavailable — checkout cannot safely proceed; ask the user to retry without claiming a ticket was purchased.

## 4. Data model

Use a relational database such as PostgreSQL for transactional seat allocation and order integrity. The four core tables are users, events, seats, and orders. A tickets table is also recommended to represent each issued ticket and enforce unique seat ownership.

### Tables and key columns

| Table | Important columns and constraints |
| --- | --- |
| users | id PK; email UNIQUE NOT NULL; display_name; created_at |
| events | id PK; title; venue_name; city; starts_at; sale_starts_at; status; created_at |
| seats | id PK; event_id FK → events.id; section; row_label; seat_number; price_cents; status (AVAILABLE, HELD, SOLD); held_by_order_id nullable FK → orders.id; hold_expires_at nullable; UNIQUE(event_id, section, row_label, seat_number) |
| orders | id PK; user_id FK → users.id; event_id FK → events.id; status (HOLDING, PAYMENT_PENDING, PAID, EXPIRED, CANCELLED, REFUNDED); total_cents; idempotency_key; created_at; expires_at; UNIQUE(user_id, idempotency_key) |
| tickets | id PK; order_id FK → orders.id; seat_id FK → seats.id; issued_to_user_id FK → users.id; ticket_code UNIQUE; issued_at; UNIQUE(seat_id) |

For production, payment attempts should normally be stored in a separate payment_attempts table with the provider's unique payment-intent ID, amount, status, and idempotency key. Store money as integer cents, not floating-point values. Add indexes for events by sale start and status, seats by event and status, orders by user and creation time, and tickets by owner.

### Relationships

- One user can create many orders; each order belongs to one user.
- One event has many seats and many orders; each seat belongs to one event.
- One order can contain several tickets; each ticket refers to one seat and one purchaser.
- A seat can be held by at most one active order and can have at most one issued ticket. The unique ticket constraint on seat_id is the final database-level guard against duplicate ticket issuance.

## 5. Preventing two people from buying the same seat

**The database transaction is the source of truth.** A seat map or cache can be slightly stale, so seeing “available” in the browser never guarantees the seat is still available.

1. The client requests a hold for specific seat IDs. The API authenticates the user, checks the sale window and queue token, and validates the requested seats.
2. In one short database transaction, the service locks the relevant seat rows in a consistent order (for example, SELECT ... FOR UPDATE) to prevent competing transactions from modifying them concurrently.
3. The service checks each seat's status and hold expiry. It updates a seat only if it is AVAILABLE or its previous hold has expired. A conditional update such as UPDATE seats SET status='HELD', held_by_order_id=?, hold_expires_at=? WHERE id=? AND (status='AVAILABLE' OR hold_expires_at < CURRENT_TIMESTAMP) must affect exactly one row per requested seat.
4. The service creates the order and updates all requested seats to HELD in that same transaction. If any seat cannot be claimed, it rolls back the whole transaction and returns 409 Conflict. Two simultaneous requests cannot both successfully change the same locked/conditional row from available to held.
5. A background expiry worker releases abandoned holds after the deadline, using a transaction and checking that the hold has not been renewed or paid. The hold must be short-lived to keep inventory moving.
6. The payment provider is called outside the seat-locking transaction; do not keep database locks open while waiting on a network. The order stays PAYMENT_PENDING until a verified provider result arrives.
7. On verified payment success, a second transaction locks the order and seats, confirms that the hold still belongs to this order and has not expired, marks seats SOLD, marks the order PAID, and inserts ticket rows. UNIQUE(tickets.seat_id) prevents a second ticket for the same seat even if application code has a bug. If the payment succeeds after a hold expired and the seats were reallocated, the system must not issue duplicate tickets; it should void/refund the payment and alert support.
8. Use idempotency keys for hold and payment requests, and process provider webhooks idempotently. A repeated request returns the original result rather than creating another order, charge, or ticket.

This combines row-level locking or conditional writes, atomic transactions, state transitions, and unique constraints. An application-only “check then insert” without a transaction is unsafe because two requests could both observe AVAILABLE before either writes.

## 6. Architecture

    ┌─────────────────────────┐
    │ Browser / Mobile Client │
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │ DNS + CDN / WAF         │
    │ static assets, bot rules│
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │ Virtual Waiting Room    │
    │ signed queue tokens     │
    └────────────┬────────────┘
                 │ admitted requests
                 ▼
    ┌─────────────────────────┐
    │ Load Balancer           │
    └────────────┬────────────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
    ┌────────────┐ ┌────────────┐
    │ API Server │ │ API Server │   ... horizontally scaled
    │     A      │ │     B      │
    └─────┬──────┘ └─────┬──────┘
          └──────┬───────┘
                 │
        ┌────────┼───────────┐
        ▼        ▼           ▼
    ┌────────┐ ┌──────────┐ ┌────────────────┐
    │ Redis  │ │ Primary  │ │ Durable Queue  │
    │ cache  │ │ Database │ │ + Workers      │
    └────────┘ └────┬─────┘ └────────────────┘
                    │ replication
                    ▼
              ┌─────────────┐
              │ Read Replica│
              └─────────────┘

    API Server ───────────────► Payment Provider
    Payment Provider ──signed webhook──► API Server

### Component responsibilities

- **Browser/mobile client:** renders event listings and seat maps, submits holds and checkout, and displays clear queue/hold/payment states.
- **DNS:** directs the hostname to the edge entry point.
- **CDN and WAF:** cache public static assets, absorb common attacks, and apply bot/rate rules. Never publicly cache personalized seat holds, orders, or tickets.
- **Virtual waiting room:** queues or admits a controlled number of users, issues signed tokens, and enforces the sale's fairness policy. It reduces the chance that 200,000 simultaneous visitors overwhelm the core system.
- **Load balancer:** routes requests only to healthy API instances.
- **Multiple stateless API servers:** scale horizontally and handle authentication, authorization, event search, seat holds, orders, and webhook processing. No single server holds the only copy of session state.
- **Redis/cache:** serves popular event descriptions and other safe read-heavy data. It is not the authoritative seat inventory; availability is confirmed by the database transaction.
- **Primary relational database:** owns seat states, orders, and ticket records; transactions, row locks, and unique constraints protect correctness.
- **Read replica:** handles suitable read-heavy queries such as event details and reports. Seat maps can use it for approximate display, but hold and checkout decisions always go to the primary to avoid stale availability.
- **Durable queue and workers:** handle email delivery, expiry sweeps, analytics, and retries asynchronously so slow background tasks do not block checkout.
- **Payment provider:** securely collects payment details and sends signed webhook events. TicketHub stores provider tokens and transaction references, not raw card details.
- **Monitoring and alerting:** watches latency, errors, queue depth, hold conflicts, payment outcomes, and database saturation so capacity can be increased before failure.

### How the design survives the big sale

1. Pre-warm and cache event pages, images, venue details, and static assets before the published sale time.
2. Put all sale traffic through a waiting room. Admit traffic at a controlled rate and provide queue position/progress; do not let retries bypass the queue.
3. Apply per-user and per-IP rate limits, a maximum number of seats per order, and idempotency keys to suppress bots and accidental duplicate submissions.
4. Scale API servers horizontally, but cap concurrent hold transactions so the database is not flooded. Queue excess requests rather than allowing unlimited database connections.
5. Keep the seat allocation transaction small and indexed. The primary database serializes competing writes to each seat; browsing can scale separately through cache and replicas.
6. Use circuit breakers and bounded timeouts for the payment provider. A payment timeout is not proof of failure: reconcile using the provider's idempotency key and webhook before retrying a charge or issuing tickets.
7. Monitor live sale metrics and stop admitting new checkout requests if the primary database or payment provider is unhealthy. A controlled queue is better than accepting requests that cannot be completed correctly.

## 7. Trade-offs

### Fairness versus maximum throughput

A waiting room and admission limits protect the database and give users a more predictable experience, but they add queue time and operational complexity. Randomized ordering for users present at the published opening can reduce the advantage of low-latency connections; FIFO after admission is simpler to explain and audit.

### Strong correctness versus read speed

Using the primary database and row locks for holds is safer than trusting cached availability, but it limits write throughput for a highly contested event and can increase response latency. Cache event metadata and use replicas for browsing, while keeping all inventory-changing decisions transactional on the primary.

### Short holds versus checkout completion

Short holds free inventory quickly for other buyers, but a user with a slow network or payment flow may lose seats. Longer holds improve convenience but allow abandoned carts to tie up scarce inventory. A clear countdown, a reasonable expiry, and safe payment reconciliation balance the two.

### Synchronous versus asynchronous work

Sending confirmation emails inside the checkout request is easy to reason about but can delay checkout when an email service is slow. A durable queue makes the purchase response faster and supports retries, but requires monitoring, idempotent workers, and a dead-letter process.

## Conclusion

TicketHub should optimize for correctness and fairness before raw speed during the sale. Caching and horizontal scaling make browsing inexpensive, while a virtual waiting room smooths demand. The primary database's atomic hold transaction, conditional updates, and unique ticket constraint prevent double-booking even when many users compete for the same seat.
