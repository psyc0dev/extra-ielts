ALTER TABLE groups ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

UPDATE groups
SET owner_user_id = (
  SELECT id
  FROM users
  WHERE role IN ('admin', 'teacher')
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE owner_user_id IS NULL;
