# School Database Design

## Tables and entities

- **`students`** represents each student. Its `student_id` is the primary key, `name` and `email` are required, and `email` is unique so two students cannot share the same email address.
- **`courses`** represents each course offered by the school. `course_id` is the primary key; the course name and teacher name are required.
- **`enrolments`** represents the fact that a student is enrolled on a course. It has its own primary key, foreign keys to `students` and `courses`, and a `grade` for that student on that course. A grade may be `NULL` until it is assessed, but if supplied it must be between 0 and 100. The pair `(student_id, course_id)` is unique, preventing the same student from enrolling on the same course twice.

## Relationships

A student can have many enrolments, but each enrolment belongs to one student: this is a **one-to-many** relationship from `students` to `enrolments`. Similarly, one course can have many enrolments, and each enrolment belongs to one course: this is a **one-to-many** relationship from `courses` to `enrolments`.

Taken together, students and courses have a **many-to-many** relationship: a student may take several courses, and a course may have several students. The `enrolments` join table is needed to represent each student-course pairing separately and to store information specific to that pairing, such as the grade. Foreign keys maintain referential integrity, and the composite unique constraint prevents duplicate pairings.

## Index

The SQL file creates `idx_enrolments_course_id` on `enrolments(course_id)`. This index can speed up queries that find all students on a particular course and joins that match enrolments to courses. SQLite already indexes primary keys and the unique student email; this additional index supports a common lookup on the course foreign key.

## SQL or NoSQL?

For this school system, I would choose **SQL**, using a relational database such as SQLite. Students, courses, and enrolments have clear relationships, and foreign keys and unique constraints help keep the data consistent. JOINs make it straightforward to list courses for a student, list students in a course, and calculate enrolment counts. A grade belongs to a specific student-course pairing, which fits the relational join-table design naturally. A NoSQL database could work, but it would require more application-level effort to enforce these relationships and constraints.
