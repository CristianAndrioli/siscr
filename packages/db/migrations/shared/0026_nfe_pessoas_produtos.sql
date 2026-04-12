-- NF-e: destinatário e produto (defaults fiscais)

ALTER TABLE pessoas ADD COLUMN inscricao_estadual TEXT;
ALTER TABLE pessoas ADD COLUMN ind_ie_dest TEXT DEFAULT '9';
ALTER TABLE pessoas ADD COLUMN codigo_municipio TEXT;
ALTER TABLE pessoas ADD COLUMN codigo_pais TEXT DEFAULT '1058';

ALTER TABLE produtos ADD COLUMN origem INTEGER DEFAULT 0;
ALTER TABLE produtos ADD COLUMN cest TEXT;
ALTER TABLE produtos ADD COLUMN icms_cst TEXT;
ALTER TABLE produtos ADD COLUMN icms_csosn TEXT;
ALTER TABLE produtos ADD COLUMN pis_cst TEXT DEFAULT '07';
ALTER TABLE produtos ADD COLUMN cofins_cst TEXT DEFAULT '07';
