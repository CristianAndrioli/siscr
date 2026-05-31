-- Migration 0033: adiciona colunas de parcelamento em contas_pagar
ALTER TABLE contas_pagar ADD COLUMN parcela INTEGER DEFAULT 1;
ALTER TABLE contas_pagar ADD COLUMN total_parcelas INTEGER DEFAULT 1;
