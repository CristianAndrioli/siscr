-- Migration 0022: campos financeiros em contas_receber e contas_pagar
-- Nr. Documento, Espécie, Data Emissão, Data Lançamento, Moeda
ALTER TABLE contas_receber ADD COLUMN nr_documento TEXT;
ALTER TABLE contas_receber ADD COLUMN especie TEXT DEFAULT 'DM';
ALTER TABLE contas_receber ADD COLUMN data_emissao TEXT;
ALTER TABLE contas_receber ADD COLUMN data_lancamento TEXT;
ALTER TABLE contas_receber ADD COLUMN moeda TEXT DEFAULT 'BRL';

ALTER TABLE contas_pagar ADD COLUMN nr_documento TEXT;
ALTER TABLE contas_pagar ADD COLUMN especie TEXT DEFAULT 'DM';
ALTER TABLE contas_pagar ADD COLUMN data_emissao TEXT;
ALTER TABLE contas_pagar ADD COLUMN data_lancamento TEXT;
ALTER TABLE contas_pagar ADD COLUMN moeda TEXT DEFAULT 'BRL';
