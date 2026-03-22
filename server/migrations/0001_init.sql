-- Dev SQLite schema for IELTS Delivery System
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  sections_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('task', 'homework')),
  test_id TEXT NOT NULL,
  section_kinds_json TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  due_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in-progress', 'completed')),
  score_total INTEGER,
  band REAL,
  reading_band REAL,
  listening_band REAL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  responses_json TEXT NOT NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
