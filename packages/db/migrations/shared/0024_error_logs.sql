CREATE TABLE IF NOT EXISTS error_logs (
  id              TEXT    PRIMARY KEY,
  tenant_id       TEXT    NOT NULL,
  timestamp       TEXT    NOT NULL,
  friendly_message TEXT   NOT NULL,
  technical       TEXT,
  stack_trace     TEXT,
  url             TEXT,
  context         TEXT,
  created_at      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_ts
  ON error_logs (tenant_id, timestamp DESC);
