ALTER TABLE group_messages ADD COLUMN reply_to_id TEXT;

CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to_id ON group_messages(reply_to_id);

CREATE TABLE IF NOT EXISTS group_message_seen (
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES group_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_group_message_seen_message_id ON group_message_seen(message_id);
CREATE INDEX IF NOT EXISTS idx_group_message_seen_user_id ON group_message_seen(user_id);
