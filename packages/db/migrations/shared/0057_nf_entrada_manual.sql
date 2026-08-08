-- Migration 0057: suporte a lançamento manual de NF-e de entrada
--
-- Até aqui a entrada só existia via XML (chave e xml_path obrigatórios).
-- Notas manuais usam chave sintética `MANUAL-…` e xml_path `manual/{id}`,
-- e a coluna `origem` distingue os dois caminhos para UI e exportações.

ALTER TABLE nf_entradas ADD COLUMN origem TEXT NOT NULL DEFAULT 'xml';
-- xml | manual

CREATE INDEX IF NOT EXISTS idx_nf_entrada_origem ON nf_entradas(tenant_id, origem);
