-- Metadados públicos do certificado A1 (extraídos no upload; JSON), para exibir validade/titular sem descriptografar o blob.
ALTER TABLE empresas ADD COLUMN a1_cert_meta TEXT;
ALTER TABLE filiais ADD COLUMN a1_cert_meta TEXT;
