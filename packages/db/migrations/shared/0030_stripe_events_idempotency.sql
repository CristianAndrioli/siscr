-- Idempotência para Stripe webhooks.
--
-- O Stripe re-entrega o mesmo evento em cenários de timeout/erro e as
-- handlers de `subscription.updated` e `subscription.deleted` escrevem
-- em `tenants` sem um guard natural, o que pode causar sobrescrita.
-- Esta tabela guarda `event_id` com `INSERT OR IGNORE` no início do
-- handler — se o evento já foi processado, o webhook responde 200 OK
-- sem reexecutar a lógica.
--
-- Retenção: sem TTL automático (D1 não suporta); um cron mensal remove
-- registros com created_at < NOW - 30 dias.

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id    TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_received_at
  ON stripe_events (received_at);
