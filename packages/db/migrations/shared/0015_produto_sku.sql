-- Migration 0015: campo SKU (Stock Keeping Unit) em produtos e serviços
-- Campo opcional, definido pelo usuário, para identificação operacional do item

ALTER TABLE produtos ADD COLUMN sku TEXT;
ALTER TABLE servicos ADD COLUMN sku TEXT;
