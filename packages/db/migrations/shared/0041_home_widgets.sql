-- ─── Home personalizável (redesign) ────────────────────────────────
-- Migration 0041: estoque mínimo (widget "Estoque crítico") + layout
-- da home por variação (widget "Personalizar").

ALTER TABLE produtos ADD COLUMN estoque_minimo REAL NOT NULL DEFAULT 0;

ALTER TABLE user_preferences ADD COLUMN home_variant TEXT NOT NULL DEFAULT 'A';
ALTER TABLE user_preferences ADD COLUMN home_layouts TEXT;
