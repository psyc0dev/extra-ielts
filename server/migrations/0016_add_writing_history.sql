-- Writing history table
CREATE TABLE IF NOT EXISTS writing_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  essay TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  overall_score REAL,
  overall_label TEXT,
  penalty REAL DEFAULT 0,
  criteria_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_writing_submissions_user ON writing_submissions(user_id, created_at DESC);
