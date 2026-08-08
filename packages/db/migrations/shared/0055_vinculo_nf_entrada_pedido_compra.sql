-- Migration 0055: vínculo entre NF-e de entrada e pedido de compra
--
-- Até aqui `nf_entradas` e `pedidos_compra` eram fluxos paralelos sem nenhuma
-- ligação, e ambos movimentavam estoque por conta própria. Ao amarrar os dois,
-- a importação da nota passa a gerar o recebimento do pedido — uma única
-- movimentação — em vez de duplicar a entrada.
--
-- O detalhe por item não precisa de tabela nova: `recebimento_itens` já guarda
-- `item_pedido_id` + quantidade. O que faltava era saber qual nota originou o
-- recebimento, daí `recebimentos_compra.nf_entrada_id`.

ALTER TABLE nf_entradas ADD COLUMN pedido_compra_id TEXT REFERENCES pedidos_compra(id);
CREATE INDEX IF NOT EXISTS idx_nf_entrada_pedido ON nf_entradas(pedido_compra_id);

ALTER TABLE recebimentos_compra ADD COLUMN nf_entrada_id TEXT REFERENCES nf_entradas(id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_compra_nf ON recebimentos_compra(nf_entrada_id);
