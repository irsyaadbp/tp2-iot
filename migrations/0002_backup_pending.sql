CREATE TABLE backup_pending (
  id TEXT PRIMARY KEY REFERENCES readings(id),
  payload TEXT NOT NULL,
  last_attempt INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX backup_pending_attempt ON backup_pending(last_attempt, id);
