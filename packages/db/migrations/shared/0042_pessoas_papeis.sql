-- ─── Papéis adicionais de Pessoa (redesign) ────────────────────────
-- Migration 0042: Vendedores e Funcionários/Operadores passam a ser
-- representados como Pessoa (tipo_cadastro), reaproveitando a mesma
-- entidade/auditoria já usada por cliente/fornecedor/transportadora.
-- tipo_cadastro ganha o valor 'vendedor' (sem CHECK constraint no SQL,
-- validado em routes/cadastros.ts via Zod).

ALTER TABLE pessoas ADD COLUMN comissao_percentual REAL;
ALTER TABLE pessoas ADD COLUMN meta_mensal REAL;
ALTER TABLE pessoas ADD COLUMN matricula TEXT;
ALTER TABLE pessoas ADD COLUMN tipo_operador TEXT;
ALTER TABLE pessoas ADD COLUMN cnh_numero TEXT;
ALTER TABLE pessoas ADD COLUMN cnh_categoria TEXT;
ALTER TABLE pessoas ADD COLUMN cnh_validade TEXT;
