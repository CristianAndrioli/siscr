-- Migration 0054: filial_id nullable em pedidos_venda e pedidos_compra
--
-- Fecha o conceito "filial é opcional; sem filial, o registro é da matriz",
-- que já valia nas demais tabelas transacionais desde as migrations 0003–0006
-- (pessoas, produtos, servicos, contas_receber, contas_pagar, estoque,
-- movimentacoes_estoque e notas_fiscais). Estas duas eram as últimas com
-- NOT NULL, o que obrigava o usuário a cadastrar uma filial fictícia só para
-- lançar pedido.
--
-- Por que o roteiro abaixo é tão longo:
--
-- 1. O D1 remoto enforça foreign keys (o local não). `PRAGMA foreign_keys = OFF`
--    não é suportado; só `defer_foreign_keys`, que adia a checagem até o commit.
-- 2. Adiar não basta. Dropar um pai com filhos incrementa o contador de
--    violações, e recriar a tabela sob outro nome + RENAME não zera esse
--    contador — o commit falha mesmo com os dados todos no lugar. Por isso os
--    filhos são salvos em tabelas de apoio e dropados ANTES dos pais, e
--    recriados depois, já apontando para os pais novos.
-- 3. `ALTER TABLE ... RENAME` reescreve as cláusulas REFERENCES das tabelas
--    dependentes. Foi assim que a migration 0003 deixou
--    `itens_pedido.produto_id` apontando para `_produtos_old`, tabela dropada
--    em seguida. Ficou latente enquanto ninguém enforçava FK; aqui a referência
--    é consertada de volta para `produtos`.

PRAGMA defer_foreign_keys = true;

-- ─── Guarda os filhos em tabelas de apoio (CTAS não copia constraints) ──

CREATE TABLE _tmp_itens_pedido         AS SELECT * FROM itens_pedido;
CREATE TABLE _tmp_itens_pedido_compra  AS SELECT * FROM itens_pedido_compra;
CREATE TABLE _tmp_recebimentos_compra  AS SELECT * FROM recebimentos_compra;
CREATE TABLE _tmp_recebimento_itens    AS SELECT * FROM recebimento_itens;

DROP TABLE recebimento_itens;
DROP TABLE itens_pedido_compra;
DROP TABLE recebimentos_compra;
DROP TABLE itens_pedido;

-- ─── pedidos_venda ────────────────────────────────────────────────

CREATE TABLE pedidos_venda_new (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  empresa_id  TEXT NOT NULL,
  filial_id   TEXT,
  cliente_id  TEXT NOT NULL,
  usuario_id  TEXT,
  numero      INTEGER NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'pedido',
  status      TEXT NOT NULL DEFAULT 'rascunho',
  total       REAL NOT NULL,
  observacoes TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT,
  created_by  TEXT REFERENCES users(id),
  updated_by  TEXT REFERENCES users(id),
  vendedor_id TEXT REFERENCES pessoas(id)
);

INSERT INTO pedidos_venda_new
  (id, tenant_id, empresa_id, filial_id, cliente_id, usuario_id, numero, tipo,
   status, total, observacoes, created_at, updated_at, created_by, updated_by, vendedor_id)
  SELECT id, tenant_id, empresa_id, filial_id, cliente_id, usuario_id, numero, tipo,
         status, total, observacoes, created_at, updated_at, created_by, updated_by, vendedor_id
  FROM pedidos_venda;

DROP TABLE pedidos_venda;

ALTER TABLE pedidos_venda_new RENAME TO pedidos_venda;

CREATE INDEX IF NOT EXISTS idx_pedidos_tenant  ON pedidos_venda(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status  ON pedidos_venda(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos_venda(cliente_id);

-- ─── pedidos_compra ───────────────────────────────────────────────

CREATE TABLE pedidos_compra_new (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  empresa_id     TEXT NOT NULL,
  filial_id      TEXT,
  fornecedor_id  TEXT NOT NULL REFERENCES pessoas(id),
  usuario_id     TEXT REFERENCES users(id),
  numero         INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'rascunho',
  total          REAL NOT NULL DEFAULT 0,
  observacoes    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  created_by     TEXT REFERENCES users(id),
  updated_by     TEXT REFERENCES users(id)
);

INSERT INTO pedidos_compra_new
  (id, tenant_id, empresa_id, filial_id, fornecedor_id, usuario_id, numero,
   status, total, observacoes, created_at, updated_at, created_by, updated_by)
  SELECT id, tenant_id, empresa_id, filial_id, fornecedor_id, usuario_id, numero,
         status, total, observacoes, created_at, updated_at, created_by, updated_by
  FROM pedidos_compra;

DROP TABLE pedidos_compra;

ALTER TABLE pedidos_compra_new RENAME TO pedidos_compra;

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_tenant ON pedidos_compra(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status ON pedidos_compra(tenant_id, status);

-- ─── Recria os filhos apontando para os pais novos ────────────────

CREATE TABLE itens_pedido (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  pedido_id      TEXT NOT NULL REFERENCES pedidos_venda(id),
  produto_id     TEXT NOT NULL REFERENCES produtos(id),
  quantidade     REAL NOT NULL,
  preco_unitario REAL NOT NULL,
  desconto       REAL NOT NULL DEFAULT 0,
  subtotal       REAL NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  created_by     TEXT REFERENCES users(id),
  updated_by     TEXT REFERENCES users(id)
);

CREATE TABLE itens_pedido_compra (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  pedido_id            TEXT NOT NULL REFERENCES pedidos_compra(id),
  produto_id           TEXT NOT NULL REFERENCES produtos(id),
  quantidade           REAL NOT NULL,
  quantidade_recebida  REAL NOT NULL DEFAULT 0,
  preco_unitario       REAL NOT NULL,
  subtotal             REAL NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT,
  created_by           TEXT REFERENCES users(id),
  updated_by           TEXT REFERENCES users(id)
);

CREATE TABLE recebimentos_compra (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  pedido_id     TEXT NOT NULL REFERENCES pedidos_compra(id),
  location      TEXT NOT NULL DEFAULT 'GERAL',
  observacoes   TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT REFERENCES users(id)
);

CREATE TABLE recebimento_itens (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  recebimento_id  TEXT NOT NULL REFERENCES recebimentos_compra(id),
  item_pedido_id  TEXT NOT NULL REFERENCES itens_pedido_compra(id),
  quantidade      REAL NOT NULL,
  created_at      TEXT NOT NULL
);

-- ─── Devolve as linhas ────────────────────────────────────────────

INSERT INTO itens_pedido
  (id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario, desconto,
   subtotal, created_at, updated_at, created_by, updated_by)
  SELECT id, tenant_id, pedido_id, produto_id, quantidade, preco_unitario, desconto,
         subtotal, created_at, updated_at, created_by, updated_by
  FROM _tmp_itens_pedido;

INSERT INTO itens_pedido_compra
  (id, tenant_id, pedido_id, produto_id, quantidade, quantidade_recebida,
   preco_unitario, subtotal, created_at, updated_at, created_by, updated_by)
  SELECT id, tenant_id, pedido_id, produto_id, quantidade, quantidade_recebida,
         preco_unitario, subtotal, created_at, updated_at, created_by, updated_by
  FROM _tmp_itens_pedido_compra;

INSERT INTO recebimentos_compra
  (id, tenant_id, pedido_id, location, observacoes, created_at, created_by)
  SELECT id, tenant_id, pedido_id, location, observacoes, created_at, created_by
  FROM _tmp_recebimentos_compra;

INSERT INTO recebimento_itens
  (id, tenant_id, recebimento_id, item_pedido_id, quantidade, created_at)
  SELECT id, tenant_id, recebimento_id, item_pedido_id, quantidade, created_at
  FROM _tmp_recebimento_itens;

CREATE INDEX IF NOT EXISTS idx_itens_pedido                  ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_compra_pedido    ON itens_pedido_compra(pedido_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_compra_pedido    ON recebimentos_compra(pedido_id);
CREATE INDEX IF NOT EXISTS idx_recebimento_itens_recebimento ON recebimento_itens(recebimento_id);

DROP TABLE _tmp_itens_pedido;
DROP TABLE _tmp_itens_pedido_compra;
DROP TABLE _tmp_recebimentos_compra;
DROP TABLE _tmp_recebimento_itens;
