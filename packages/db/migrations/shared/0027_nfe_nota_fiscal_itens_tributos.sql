-- NF-e: tributação por linha da nota (preenchimento manual ou motor futuro)

ALTER TABLE nota_fiscal_itens ADD COLUMN origem INTEGER DEFAULT 0;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_cst TEXT;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_csosn TEXT;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_modalidade_bc INTEGER;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_base_calculo REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_aliquota REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_valor REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_credito_aliquota REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN icms_credito_valor REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN pis_cst TEXT;
ALTER TABLE nota_fiscal_itens ADD COLUMN pis_base_calculo REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN pis_aliquota REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN pis_valor REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN cofins_cst TEXT;
ALTER TABLE nota_fiscal_itens ADD COLUMN cofins_base_calculo REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN cofins_aliquota REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN cofins_valor REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN ipi_cst TEXT;
ALTER TABLE nota_fiscal_itens ADD COLUMN ipi_base_calculo REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN ipi_aliquota REAL;
ALTER TABLE nota_fiscal_itens ADD COLUMN ipi_valor REAL;
