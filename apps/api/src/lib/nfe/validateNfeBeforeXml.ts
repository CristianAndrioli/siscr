import { onlyDigits } from './xmlEscape'

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

/**
 * Validações antes de gerar XML de NF-e (sem SEFAZ).
 * Reduz rejeições futuras e falhas de montagem do documento.
 */
export function validateNfeBeforeXml(input: {
  empresa: Record<string, unknown>
  filial: Record<string, unknown> | null
  pessoa: Record<string, unknown> | null
  itens: Record<string, unknown>[]
}): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const emp = input.empresa
  const fil = input.filial

  const logr = str(fil?.logradouro) || str(emp.logradouro)
  const num = str(fil?.numero) || str(emp.numero)
  const bairro = str(fil?.bairro) || str(emp.bairro)
  const cidade = str(fil?.cidade) || str(emp.cidade)
  const uf = (str(fil?.uf) || str(emp.uf)).trim().toUpperCase()
  const cep = onlyDigits(str(fil?.cep) || str(emp.cep), 8)
  const codMun = onlyDigits(str(fil?.codigo_municipio) || str(emp.codigo_municipio), 7)

  if (onlyDigits(str(emp.cnpj)).length !== 14) {
    errors.push('CNPJ da empresa deve ter 14 dígitos.')
  }

  // IE do emitente: SEFAZ rejeita 209 se vier vazia/ISENTO indevido.
  // Preferir IE da filial quando a nota for emitida por filial.
  const ieEmit =
    onlyDigits(str(fil?.inscricao_estadual), 14) || onlyDigits(str(emp.inscricao_estadual), 14)
  if (!ieEmit) {
    errors.push(
      'Inscrição Estadual do emitente é obrigatória (cadastro da empresa ou filial). Sem IE válida a SEFAZ rejeita com cStat 209.',
    )
  }
  if (!logr.trim()) errors.push('Logradouro do emitente é obrigatório (empresa ou filial).')
  if (!num.trim()) errors.push('Número do endereço do emitente é obrigatório.')
  if (!bairro.trim()) errors.push('Bairro do emitente é obrigatório.')
  if (!cidade.trim()) errors.push('Cidade do emitente é obrigatória.')
  if (!/^[A-Z]{2}$/.test(uf)) errors.push('UF do emitente deve ter 2 letras.')
  if (cep.length !== 8) errors.push('CEP do emitente deve ter 8 dígitos.')
  if (codMun.length !== 7) {
    errors.push('Código IBGE do município do emitente deve ter 7 dígitos (cadastro da empresa/filial).')
  }

  if (!input.pessoa) {
    errors.push('Destinatário é obrigatório para NF-e de venda.')
  } else {
    const p = input.pessoa
    const doc = onlyDigits(str(p.cpf_cnpj))
    if (doc.length !== 11 && doc.length !== 14) {
      errors.push('CPF (11) ou CNPJ (14) do destinatário inválido.')
    }
    const plogr = str(p.logradouro)
    const pnum = str(p.numero)
    const pbairro = str(p.bairro)
    const pcid = str(p.cidade)
    const puf = str(p.uf).trim().toUpperCase()
    const pcep = onlyDigits(str(p.cep), 8)
    const pcod = onlyDigits(str(p.codigo_municipio), 7)
    const pais = onlyDigits(str(p.codigo_pais) || '1058', 4) || '1058'
    if (!plogr.trim()) errors.push('Logradouro do destinatário é obrigatório (cadastro da pessoa).')
    if (!pnum.trim()) errors.push('Número do endereço do destinatário é obrigatório.')
    if (!pbairro.trim()) errors.push('Bairro do destinatário é obrigatório.')
    if (!pcid.trim()) errors.push('Cidade do destinatário é obrigatória.')
    if (pais === '1058' && puf !== 'EX' && !/^[A-Z]{2}$/.test(puf)) {
      errors.push('UF do destinatário deve ter 2 letras.')
    }
    if (pcep.length !== 8) errors.push('CEP do destinatário deve ter 8 dígitos.')
    if (pais === '1058' && puf !== 'EX' && pcod.length !== 7) {
      errors.push('Código IBGE do município do destinatário deve ter 7 dígitos (cadastro da pessoa).')
    }
  }

  if (input.itens.length === 0) {
    errors.push('A nota deve ter pelo menos um item.')
  }

  for (let i = 0; i < input.itens.length; i++) {
    const ni = input.itens[i]!
    const cfop = onlyDigits(str(ni.cfop), 4)
    const ncm = str(ni.ncm).replace(/\D/g, '')
    const q = Number(ni.quantidade)
    if (cfop.length !== 4) {
      errors.push(`Item ${i + 1}: CFOP deve ter 4 dígitos.`)
    }
    if (ncm.length !== 8) {
      errors.push(`Item ${i + 1}: NCM deve ter 8 dígitos.`)
    }
    if (!Number.isFinite(q) || q <= 0) {
      errors.push(`Item ${i + 1}: quantidade deve ser maior que zero.`)
    }
  }

  return { ok: errors.length === 0, errors }
}
