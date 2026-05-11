CREATE TABLE IF NOT EXISTS otp_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_attempts_ip_time ON otp_attempts (ip, attempted_at);
