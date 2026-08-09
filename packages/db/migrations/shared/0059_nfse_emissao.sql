-- NFS-e: IM, numeração/ambiente por empresa e campos de transmissão

ALTER TABLE empresas ADD COLUMN inscricao_municipal TEXT;
ALTER TABLE empresas ADD COLUMN nfse_serie TEXT DEFAULT '1';
ALTER TABLE empresas ADD COLUMN nfse_ambiente INTEGER DEFAULT 2;
ALTER TABLE empresas ADD COLUMN nfse_proximo_numero INTEGER DEFAULT 1;
ALTER TABLE empresas ADD COLUMN nfse_codigo_servico_padrao TEXT;

ALTER TABLE filiais ADD COLUMN inscricao_municipal TEXT;
