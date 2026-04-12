-- NF-e: resultado de transmissão SEFAZ e campos de pagamento/frete

ALTER TABLE notas_fiscais ADD COLUMN ambiente INTEGER DEFAULT 2;
ALTER TABLE notas_fiscais ADD COLUMN modelo INTEGER DEFAULT 55;
ALTER TABLE notas_fiscais ADD COLUMN protocolo_autorizacao TEXT;
ALTER TABLE notas_fiscais ADD COLUMN data_autorizacao TEXT;
ALTER TABLE notas_fiscais ADD COLUMN cstat_ultimo TEXT;
ALTER TABLE notas_fiscais ADD COLUMN xmotivo_ultimo TEXT;
ALTER TABLE notas_fiscais ADD COLUMN xml_cancelamento_path TEXT;
ALTER TABLE notas_fiscais ADD COLUMN protocolo_cancelamento TEXT;
ALTER TABLE notas_fiscais ADD COLUMN forma_pagamento TEXT;
ALTER TABLE notas_fiscais ADD COLUMN mod_frete INTEGER DEFAULT 9;
ALTER TABLE notas_fiscais ADD COLUMN valor_troco REAL DEFAULT 0;
ALTER TABLE notas_fiscais ADD COLUMN transmissao_tentativas INTEGER DEFAULT 0;
ALTER TABLE notas_fiscais ADD COLUMN transmissao_erro TEXT;
