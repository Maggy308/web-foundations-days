# SnapShare: Scaling Plan

## 1. Assumptions and capacity estimates

SnapShare is a photo-sharing app where people upload photos and scroll a feed of photos from accounts they follow.

### Given facts and assumptions

- Registered users: **10,000,000**.
- Daily active users (DAU): **10% of registered users**.
- Each DAU uploads **1 original photo per day**.
- Each DAU views **50 feed pages per day**.
- Average original photo size: **2 MB**.
- Each photo also has one thumbnail of **50 KB**.
- For these estimates, use decimal units: 1 MB = 1,000,000 bytes and 1 GB = 1,000 MB.
- Assume traffic is spread across 24 hours for average rates. Real traffic is bursty, so estimate peak feed views as **5 times the average**. The prompt only specifies a peak multiplier for feed views, so no peak upload multiplier is assumed.
- Assume all uploaded photos and thumbnails are retained for one year, with no deletions, compression changes, replication overhead, or additional derived sizes included in the storage estimate.
- The storage estimate includes both the original and one thumbnail for each photo. Database metadata is small compared with the image files and is excluded from image storage totals.

### Daily active users

10,000,000 registered users × 10% active per day = **1,000,000 daily active users (DAU)**.

### Uploads per second

Daily uploads = 1,000,000 DAU × 1 photo per DAU per day = **1,000,000 uploads/day**.

Average uploads per second = 1,000,000 ÷ 86,400 seconds/day ≈ **11.6 uploads/second** (about 12 per second on average).

### Feed views per second

Daily feed views = 1,000,000 DAU × 50 feed pages per DAU per day = **50,000,000 feed views/day**.

- Average feed views/second = 50,000,000 ÷ 86,400 ≈ **578.7**, or about **579 feed views/second**.
- Estimated peak feed views/second = 578.7 × 5 ≈ **2,893.5**, or about **2,894 feed views/second**.

A feed page may contain several photos, so the number of individual photo deliveries can be much higher than the feed-page request rate.

### Photo storage per year

Each uploaded photo creates:
- Original: 2 MB
- Thumbnail: 50 KB = 0.05 MB
- Total per upload: **2.05 MB**

At 1,000,000 uploads/day:
- Original photos per day: 1,000,000 × 2 MB = **2,000,000 MB = 2,000 GB = 2 TB/day**.
- Thumbnails per day: 1,000,000 × 0.05 MB = **50,000 MB = 50 GB/day**.
- Combined image storage per day: **2,050 GB = 2.05 TB/day**.
- Combined image storage per 365-day year: 2.05 TB/day × 365 = **748.25 TB/year** (decimal units), consisting of about **730 TB of originals** and **18.25 TB of thumbnails**.

This is the logical size of one retained copy of all originals and thumbnails. Production capacity should be higher to allow for backups, object-store replication, growth, temporary uploads, and other renditions.

## 2. Read-heavy or write-heavy?

SnapShare is **read-heavy by request count**: 50 million feed-page views per day compared with 1 million photo uploads per day, or about 50 feed views for every upload. Feed views are not the same as individual image downloads, which increase the read workload further.

This means the design should optimize reads: cache frequently requested feed data, serve image bytes through a CDN close to users, and send read queries to a database read replica where appropriate. Uploads still need reliable write handling, durable object storage, and asynchronous thumbnail processing, but the larger request volume makes read scalability especially important.

## 3. Where photo files should be stored

Photo binaries should **not** be stored inside database rows as large BLOBs. At the estimated scale, image files account for roughly 748.25 TB per year; putting them in the main database would inflate database backups and replication, consume database resources with large binary transfers, and make it harder to cache and deliver images efficiently.

Store original photos and generated thumbnails in **object storage** (for example, an S3-compatible object store) and keep only metadata and object keys in the database. The CDN can cache and deliver public or appropriately authorized image URLs from object storage, while the database handles structured data such as users, follows, post records, object keys, timestamps, and feed-related metadata.

## 4. Architecture diagram

```text
                         ┌──────────────────────┐
                         │   Mobile / Web App   │
                         └──────────┬───────────┘
                                    │
                     Feed/API reads │ Upload/API requests
                                    ▼
                         ┌──────────────────────┐
                         │    Load Balancer     │
                         └──────────┬───────────┘
                                    │
                      ┌─────────────┴──────────────┐
                      ▼                            ▼
             ┌────────────────┐          ┌────────────────┐
             │  App Server A  │          │  App Server B  │
             └───────┬────────┘          └───────┬────────┘
                     └──────────────┬────────────┘
                                    │
                    ┌───────────────┼──────────────────┐
                    ▼               ▼                  ▼
             ┌────────────┐  ┌──────────────┐  ┌─────────────────┐
             │ Feed Cache │  │ Primary DB   │  │ Object Storage  │
             │ (e.g. Redis)│ │ users, posts,│  │ originals and   │
             └────────────┘  │ follows, keys│  │ thumbnails      │
                             └──────┬───────┘  └────────▲────────┘
                                    │ replication       │ write thumbnail
                                    ▼                   │
                             ┌──────────────┐     ┌─────┴──────────┐
                             │ DB Read      │     │ Thumbnail      │
                             │ Replica      │     │ Worker         │
                             └──────────────┘     └─────▲──────────┘
                                                        │
                                                 ┌──────┴────────┐
                                                 │ Job Queue     │
                                                 └───────────────┘

       Image delivery path:
       Mobile / Web App ── request image ──> CDN ── cache miss ──> Object Storage
```

The load balancer routes API requests to healthy app servers. Image downloads use the CDN path so most image bytes do not pass through app servers.

## 5. What each component solves

- **Mobile / Web App:** Provides the user interface for uploading photos and browsing the feed.
- **CDN (Content Delivery Network):** Caches and serves image files near users, reducing latency, origin traffic, and repeated downloads from object storage.
- **Load balancer:** Distributes API traffic across healthy app servers and avoids sending all requests to one instance.
- **App servers:** Authenticate requests, validate upload metadata, create post records, build feed responses, and coordinate access to storage and queues.
- **Feed cache:** Stores frequently requested feed data or metadata for a short time to reduce repeated database reads and improve response time.
- **Primary database:** Durably stores structured records such as users, follows, posts, object keys, and timestamps.
- **Database read replica:** Serves suitable read queries so feed-related reads do not overload the primary database; replication can introduce a small delay before new data appears.
- **Object storage:** Stores the large original photo files and generated thumbnails durably and independently of the database.
- **Job queue:** Buffers thumbnail tasks so an upload can complete without waiting for image processing, and helps absorb traffic spikes.
- **Thumbnail worker:** Consumes queued jobs, creates resized/compressed thumbnails, and saves them to object storage.

## 6. Step-by-step photo upload flow

1. The user selects a photo in the mobile or web app and submits the upload.
2. The app server authenticates the user, validates the file type and size, and creates an upload record or a pending post in the primary database.
3. The client uploads the original photo to object storage, ideally using a short-lived signed upload URL so large file bytes do not travel through the app server.
4. After the object upload succeeds, the app server records the object key and marks the post as uploaded/ready in the database. The post metadata includes the owner, timestamp, and original photo key.
5. The app server publishes a thumbnail job to the queue with the original object key, destination key, and post ID.
6. The server responds to the client that the upload has been accepted; the original photo can be available while thumbnail processing continues.
7. A thumbnail worker reads the queued job, fetches the original from object storage, creates a 50 KB target thumbnail (or the closest suitable compressed rendition), and uploads it to object storage.
8. The worker updates the post metadata with the thumbnail object key and marks thumbnail processing complete. Jobs can be retried if a transient error occurs.
9. When followers refresh their feeds, app servers use cached feed data and database reads as needed to retrieve post metadata; the client requests image URLs through the CDN, which serves cached images or fetches a cache miss from object storage.

The implementation should make job handling idempotent, so retrying the same thumbnail job does not create duplicate posts or inconsistent metadata.

## 7. Trade-offs

- **Caching versus freshness:** A feed cache greatly reduces database load and response time, but a newly uploaded photo or follow change may not appear immediately. Cache invalidation, short time-to-live values, or targeted updates can improve freshness at the cost of complexity.
- **Asynchronous thumbnails versus immediate completeness:** A queue lets uploads finish quickly and protects app servers from image-processing spikes, but the thumbnail may not be ready immediately. The UI should tolerate a temporary placeholder and the system should monitor and retry failed jobs.
- **Read replicas versus consistency:** A read replica increases read capacity, but replication lag can mean a newly created post is briefly missing from a feed query. Critical read-after-write requests may need to use the primary database.
- **CDN performance versus access control:** Public, cacheable images are fast and inexpensive to deliver, but private photos require signed URLs or carefully designed authorization and cache policies, adding complexity.
- **Object storage versus one database store:** Object storage is better suited to large files and scales independently, but the application must coordinate database metadata with object uploads and handle orphaned files or failed uploads.
- **Durability versus storage cost:** Replication and backups improve resilience, but the estimated 748.25 TB of new image data per year means these protections add significant storage and transfer costs.

## 8. Summary

With 1 million daily active users, SnapShare expects about 1 million uploads per day (11.6 uploads/second on average), 50 million feed views per day (579/second average and about 2,894/second at the assumed 5× peak), and roughly 748.25 TB of new original-photo and thumbnail storage each year. The architecture separates concerns: a CDN and cache accelerate read-heavy traffic, a relational database stores metadata, object storage holds photo bytes, and a queue plus workers processes thumbnails asynchronously.
