-- ─── Remove Formas de pagamento (redesign) ─────────────────────────
-- Migration 0046: cadastro removido a pedido — forma de pagamento é
-- gerada na emissão da nota fiscal, não há outro caso de uso hoje.
-- Se precisar no futuro, recriar com uma migration nova (não reverter
-- esta), pois 0044 já rodou em produção.

DROP TABLE IF EXISTS formas_pagamento;
