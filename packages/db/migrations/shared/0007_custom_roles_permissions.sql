-- Perfis de permissão personalizados por tenant + vínculo opcional em users

CREATE TABLE IF NOT EXISTS tenant_custom_roles (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  nome         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_custom_roles_tenant ON tenant_custom_roles(tenant_id);

CREATE TABLE IF NOT EXISTS tenant_custom_role_modules (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  custom_role_id  TEXT NOT NULL,
  module_key      TEXT NOT NULL,
  can_view        INTEGER NOT NULL DEFAULT 0,
  can_edit        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  UNIQUE(custom_role_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tcrm_tenant_role ON tenant_custom_role_modules(tenant_id, custom_role_id);

-- SQLite: adicionar coluna se ainda não existir (migrations idempotentes simplificadas)
ALTER TABLE users ADD COLUMN custom_role_id TEXT;
