-- Migration 0020: identificação de parcelas em contas_receber
ALTER TABLE contas_receber ADD COLUMN parcela INTEGER DEFAULT 1;
ALTER TABLE contas_receber ADD COLUMN total_parcelas INTEGER DEFAULT 1;
