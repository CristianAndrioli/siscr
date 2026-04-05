-- Trilha de auditoria: quem criou/atualizou + timestamps onde faltavam.
-- created_by / updated_by referenciam users(id); valores NULL em dados legados ou jobs sem sessão.

ALTER TABLE empresas ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE empresas ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE filiais ADD COLUMN updated_at TEXT;
ALTER TABLE filiais ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE filiais ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE user_permissions ADD COLUMN updated_at TEXT;
ALTER TABLE user_permissions ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE user_permissions ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE pessoas ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE pessoas ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE produtos ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE produtos ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE servicos ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE servicos ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE estoque ADD COLUMN created_at TEXT;
ALTER TABLE estoque ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE estoque ADD COLUMN updated_by TEXT REFERENCES users(id);
UPDATE estoque SET created_at = updated_at WHERE created_at IS NULL;

ALTER TABLE movimentacoes_estoque ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE movimentacoes_estoque ADD COLUMN updated_by TEXT REFERENCES users(id);
ALTER TABLE movimentacoes_estoque ADD COLUMN updated_at TEXT;
UPDATE movimentacoes_estoque SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE pedidos_venda ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE pedidos_venda ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE itens_pedido ADD COLUMN updated_at TEXT;
ALTER TABLE itens_pedido ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE itens_pedido ADD COLUMN updated_by TEXT REFERENCES users(id);
UPDATE itens_pedido SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE contas_receber ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE contas_receber ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE contas_pagar ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE contas_pagar ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE notas_fiscais ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE notas_fiscais ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE nota_fiscal_itens ADD COLUMN updated_at TEXT;
ALTER TABLE nota_fiscal_itens ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE nota_fiscal_itens ADD COLUMN updated_by TEXT REFERENCES users(id);
UPDATE nota_fiscal_itens SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE cotacoes ADD COLUMN updated_at TEXT;
ALTER TABLE cotacoes ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE cotacoes ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE cotacao_itens ADD COLUMN updated_at TEXT;
ALTER TABLE cotacao_itens ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE cotacao_itens ADD COLUMN updated_by TEXT REFERENCES users(id);
UPDATE cotacao_itens SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE locais ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE locais ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE tenant_custom_roles ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE tenant_custom_roles ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE tenant_custom_role_modules ADD COLUMN updated_at TEXT;
ALTER TABLE tenant_custom_role_modules ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE tenant_custom_role_modules ADD COLUMN updated_by TEXT REFERENCES users(id);

ALTER TABLE users ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN updated_by TEXT REFERENCES users(id);

-- tenants: sem FK (usuário ainda pode não existir no signup / webhook)
ALTER TABLE tenants ADD COLUMN created_by TEXT;
ALTER TABLE tenants ADD COLUMN updated_by TEXT;
