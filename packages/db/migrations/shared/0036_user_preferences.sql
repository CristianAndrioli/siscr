-- Migration: 0036_user_preferences
-- Adds per-user UI personalization preferences table

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL,
  accent_color    TEXT NOT NULL DEFAULT '#4f46e5',
  sidebar_mode    TEXT NOT NULL DEFAULT 'icons',
  home_layout     TEXT NOT NULL DEFAULT 'grid',
  theme           TEXT NOT NULL DEFAULT 'system',
  density         TEXT NOT NULL DEFAULT 'normal',
  recent_items_count INTEGER NOT NULL DEFAULT 5,
  recent_items    TEXT NOT NULL DEFAULT '[]',
  visible_modules TEXT NOT NULL DEFAULT '[]',
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_tenant ON user_preferences(tenant_id);
