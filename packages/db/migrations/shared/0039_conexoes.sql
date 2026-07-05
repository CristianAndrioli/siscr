-- ─── Conexões (named credentials) ────────────────────────────────
-- Migration 0039: credenciais de integração configuráveis por tela.
-- Segredo criptografado (AES-256-GCM) — nunca retornado pela API.

CREATE TABLE IF NOT EXISTS conexoes (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  empresa_id          TEXT,                    -- opcional: conexão específica de uma empresa
  nome                TEXT NOT NULL,           -- slug único por tenant (ex: "dominio", "sefaz-dfe")
  descricao           TEXT,
  tipo                TEXT NOT NULL DEFAULT 'http',
                      -- http | dominio | onvio | alterdata | sefaz_dfe
  base_url            TEXT NOT NULL,
  auth_tipo           TEXT NOT NULL DEFAULT 'none',
                      -- none | basic | bearer | api_key_header
  auth_config         TEXT,                    -- JSON não-secreto (header name, username…)
  secret_enc          TEXT,                    -- segredo cifrado (base64 iv+ciphertext)
  ativo               INTEGER NOT NULL DEFAULT 1,
  ultimo_teste_em     TEXT,
  ultimo_teste_status TEXT,                    -- ok | erro
  ultimo_teste_detalhe TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT,
  created_by          TEXT,
  updated_by          TEXT
);

CREATE INDEX IF NOT EXISTS idx_conexoes_tenant ON conexoes(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conexoes_tenant_nome ON conexoes(tenant_id, nome);
