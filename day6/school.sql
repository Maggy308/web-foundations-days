-- Day 6 assignment: School database
-- Entities: students, courses, and enrolments (the relationship between them).
-- SQLite: enable foreign-key enforcement for this connection.
PRAGMA foreign_keys = ON;

-- Students: one row per student.
CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

-- Courses: one row per course.
CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL UNIQUE,
    teacher_name TEXT NOT NULL
);

-- Enrolments links students to courses and records the student's grade.
-- The composite UNIQUE constraint prevents duplicate enrolments.
CREATE TABLE enrolments (
    enrolment_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade REAL CHECK (grade IS NULL OR (grade >= 0 AND grade <= 100)),
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    UNIQUE (student_id, course_id)
);

-- Example index: speeds up lookups of everyone enrolled in a course.
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);

-- Sample students (four students so the no-enrolments query returns a row).
INSERT INTO students (student_id, name, email) VALUES
    (1, 'Amina Patel', 'amina.patel@example.com'),
    (2, 'Brian Otieno', 'brian.otieno@example.com'),
    (3, 'Chloe Mensah', 'chloe.mensah@example.com'),
    (4, 'Daniel Kimani', 'daniel.kimani@example.com');

-- Sample courses.
INSERT INTO courses (course_id, course_name, teacher_name) VALUES
    (1, 'Database Fundamentals', 'Ms. Njeri'),
    (2, 'Web Development', 'Mr. Kamau'),
    (3, 'Computer Networks', 'Dr. Okafor');

-- Sample enrolments and grades (at least five).
INSERT INTO enrolments (enrolment_id, student_id, course_id, grade) VALUES
    (1, 1, 1, 88),
    (2, 1, 2, 91),
    (3, 2, 1, 76),
    (4, 3, 1, 94),
    (5, 3, 3, 82);

-- QUERY 1: All courses for one student, selected by the student's name.
SELECT s.name AS student_name, c.course_name, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Amina Patel'
ORDER BY c.course_name;

-- QUERY 2: All students enrolled on one course.
SELECT c.course_name, s.name AS student_name, s.email, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_name = 'Database Fundamentals'
ORDER BY s.name;

-- QUERY 3: Number of students enrolled in each course, including courses with none.
SELECT c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- QUERY 4: Students who have no enrolments.
SELECT s.student_id, s.name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.enrolment_id IS NULL
ORDER BY s.name;

-- QUERY 5: Update one enrolment's grade.
UPDATE enrolments
SET grade = 90
WHERE student_id = 1 AND course_id = 1;

-- Optional check: show the updated grade.
SELECT s.name AS student_name, c.course_name, e.grade
FROM enrolments AS e
JOIN students AS s ON s.student_id = e.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE e.student_id = 1 AND e.course_id = 1;
