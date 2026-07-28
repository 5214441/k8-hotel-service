CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  services TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  completed_at TEXT,
  accepted_by TEXT,
  completed_by TEXT,
  client_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_room_created ON tickets(room, created_at DESC);
