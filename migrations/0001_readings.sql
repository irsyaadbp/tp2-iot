CREATE TABLE readings (
  id TEXT PRIMARY KEY,
  device TEXT NOT NULL CHECK (device IN ('A','B','C')),
  session TEXT NOT NULL,
  seq INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  temp_centi INTEGER NOT NULL,
  humidity_centi INTEGER NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device, session, seq)
);
CREATE INDEX readings_device_time ON readings(device, timestamp DESC);
