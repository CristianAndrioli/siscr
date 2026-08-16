-- Migration 0060: mesa de suporte (agentes internos, tickets, chat, sessões da IA)
-- Isolamento: tabelas support_* no D1 compartilhado. Agentes NÃO têm tenant_id.
-- Tickets de cliente carregam tenant_id + snapshot (slug/nome/e-mail) para o desk.

CREATE TABLE IF NOT EXISTS support_agents (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('master', 'agent')),
  ativo INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_agents_email ON support_agents (email);
CREATE INDEX IF NOT EXISTS idx_support_agents_ativo ON support_agents (ativo);

CREATE TABLE IF NOT EXISTS support_ai_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ticket_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_ai_sessions_tenant_user
  ON support_ai_sessions (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ai_sessions_ticket
  ON support_ai_sessions (ticket_id);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tenant_slug TEXT NOT NULL,
  tenant_nome TEXT NOT NULL,
  created_by_user_id TEXT,
  created_by_nome TEXT,
  created_by_email TEXT,
  assigned_agent_id TEXT,
  kind TEXT NOT NULL DEFAULT 'support' CHECK (kind IN ('support', 'development')),
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'user', 'agent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'waiting_client', 'waiting_agent', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject TEXT NOT NULL,
  parent_ticket_id TEXT,
  ai_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_kind ON support_tickets (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets (assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_parent ON support_tickets (parent_ticket_id);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT,
  session_id TEXT,
  author_type TEXT NOT NULL CHECK (author_type IN ('ai', 'client', 'agent', 'system')),
  author_id TEXT,
  author_nome TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_session ON support_messages (session_id, created_at);
