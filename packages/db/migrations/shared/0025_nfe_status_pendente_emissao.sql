-- Notas com XML já gerado: alinhar status ao fluxo (pendente_emissao = pronta para envio SEFAZ).
UPDATE notas_fiscais
SET status = 'pendente_emissao'
WHERE tipo = 'nfe'
  AND xml_path IS NOT NULL
  AND TRIM(xml_path) != ''
  AND status = 'rascunho';
