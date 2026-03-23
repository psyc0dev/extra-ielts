PRAGMA foreign_keys = OFF;

-- Rebuild assignments without FK to tests
CREATE TABLE IF NOT EXISTS assignments_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('task', 'homework')),
  test_id TEXT NOT NULL,
  section_kinds_json TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  due_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO assignments_new (id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at)
SELECT id, type, test_id, section_kinds_json, assigned_to, assigned_by, due_at, created_at
FROM assignments;

DROP TABLE assignments;
ALTER TABLE assignments_new RENAME TO assignments;

-- Rebuild attempts without section timer columns and without FK to tests
CREATE TABLE IF NOT EXISTS attempts_new (
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO attempts_new (id, assignment_id, test_id, user_id, status, score_total, band, reading_band, listening_band, started_at, completed_at, responses_json)
SELECT id, assignment_id, test_id, user_id, status, score_total, band, reading_band, listening_band, started_at, completed_at, responses_json
FROM attempts;

DROP TABLE attempts;
ALTER TABLE attempts_new RENAME TO attempts;

DROP TABLE IF EXISTS tests;

PRAGMA foreign_keys = ON;
