# Library Books REST API

Base URL: `https://api.example.com`

The API manages a collection of books. Paths use `/books`, and each book has a unique `id`. JSON request and response bodies use the `application/json` content type.

## Endpoints

- **List all books**
  - **Method:** `GET`
  - **Path:** `/books`
  - **Description:** Returns the collection of books.
  - **Success:** `200 OK`

- **Get one book**
  - **Method:** `GET`
  - **Path:** `/books/{id}`
  - **Description:** Returns the book with the specified ID.
  - **Success:** `200 OK`

- **Create a book**
  - **Method:** `POST`
  - **Path:** `/books`
  - **Description:** Creates a book and returns the saved resource.
  - **Example request body:**
    ```json
    {
      "title": "The Hobbit",
      "author": "J. R. R. Tolkien",
      "publishedYear": 1937,
      "isbn": "9780547928227"
    }
    ```
  - **Success:** `201 Created`

- **Update a book**
  - **Method:** `PUT`
  - **Path:** `/books/{id}`
  - **Description:** Replaces the editable details of the specified book.
  - **Example request body:**
    ```json
    {
      "title": "The Hobbit",
      "author": "J. R. R. Tolkien",
      "publishedYear": 1937,
      "isbn": "9780547928227"
    }
    ```
  - **Success:** `200 OK`

- **Delete a book**
  - **Method:** `DELETE`
  - **Path:** `/books/{id}`
  - **Description:** Deletes the specified book.
  - **Success:** `204 No Content`

- **List books by author**
  - **Method:** `GET`
  - **Path:** `/books?author=J.%20R.%20R.%20Tolkien`
  - **Description:** Returns books whose author matches the `author` query parameter (URL-encoded).
  - **Success:** `200 OK`

## Error responses

- **`400 Bad Request`** — The request is invalid, such as a create request missing the required `title` or `author` field. The response can include a message explaining the validation problem.
- **`404 Not Found`** — The requested book ID does not exist, for example `GET /books/9999` when no book has that ID.

## Example error body

```json
{
  "error": "Bad Request",
  "message": "The title field is required."
}
```
