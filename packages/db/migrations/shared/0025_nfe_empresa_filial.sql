-- NF-e: configuração fiscal do emitente (empresa e filial)

ALTER TABLE empresas ADD COLUMN codigo_municipio TEXT;
ALTER TABLE empresas ADD COLUMN crt TEXT DEFAULT '1';
ALTER TABLE empresas ADD COLUMN cnae TEXT;
ALTER TABLE empresas ADD COLUMN nfe_serie TEXT DEFAULT '1';
ALTER TABLE empresas ADD COLUMN nfe_ambiente INTEGER DEFAULT 2;
ALTER TABLE empresas ADD COLUMN nfe_proximo_numero INTEGER DEFAULT 1;

ALTER TABLE filiais ADD COLUMN codigo_municipio TEXT;
ALTER TABLE filiais ADD COLUMN inscricao_estadual TEXT;
ALTER TABLE filiais ADD COLUMN complemento TEXT;
