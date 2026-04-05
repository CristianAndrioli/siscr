-- Certificado digital A1 (armazenamento cifrado no R2; metadados no D1)
ALTER TABLE empresas ADD COLUMN a1_r2_object_key TEXT;
ALTER TABLE empresas ADD COLUMN a1_cert_uploaded_at TEXT;
