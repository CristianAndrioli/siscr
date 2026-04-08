-- Migration 0017: campo complemento em pessoas (endereço)
ALTER TABLE pessoas ADD COLUMN complemento TEXT;
