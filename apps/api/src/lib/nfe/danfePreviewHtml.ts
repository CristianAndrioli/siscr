/** Prévia visual para testes — não substitui layout oficial SEFAZ nem bibliotecas de DANFE em PDF. */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function onlyDigits(s: string, max: number): string {
  const d = s.replace(/\D/g, '')
  return d.slice(0, max)
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function chaveFormatada44(chave: string): string {
  const d = onlyDigits(chave, 44).padStart(44, '0').slice(0, 44)
  const parts: string[] = []
  for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4))
  return parts.join(' ')
}

export type DanfePreviewEmitente = {
  razaoSocial: string
  cnpj: string
  ie?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

export type DanfePreviewDest = {
  nome: string
  doc: string
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

export type DanfePreviewItem = {
  descricao: string
  quantidade: number
  unidade: string
  valorUnitario: number
  valorTotal: number
  ncm?: string | null
  cfop?: string | null
}

export type DanfePreviewInput = {
  numero: string
  serie: string
  naturezaOperacao: string
  ambiente: string
  chaveAcesso: string
  dataEmissao?: string | null
  emitente: DanfePreviewEmitente
  destinatario: DanfePreviewDest | null
  itens: DanfePreviewItem[]
  valorTotal: number
}

export function buildDanfePreviewHtml(data: DanfePreviewInput): string {
  const ch = onlyDigits(data.chaveAcesso, 44)
  const ambLabel = data.ambiente === '1' ? 'Produção' : 'Homologação'

  const endEmit = [
    [data.emitente.logradouro, data.emitente.numero].filter(Boolean).join(', '),
    data.emitente.bairro,
    [data.emitente.cidade, data.emitente.uf].filter(Boolean).join(' / '),
    data.emitente.cep ? `CEP ${onlyDigits(data.emitente.cep, 8)}` : '',
  ]
    .filter(Boolean)
    .join(' — ')

  const destBlock = data.destinatario
    ? `
    <div class="box">
      <div class="box-h">Destinatário / Remetente</div>
      <p><strong>${esc(data.destinatario.nome)}</strong></p>
      <p class="small">CNPJ/CPF: ${esc(onlyDigits(data.destinatario.doc, 14))}</p>
      <p class="small">${esc(
        [
          [data.destinatario.logradouro, data.destinatario.numero].filter(Boolean).join(', '),
          data.destinatario.bairro,
          [data.destinatario.cidade, data.destinatario.uf].filter(Boolean).join(' / '),
          data.destinatario.cep ? `CEP ${onlyDigits(data.destinatario.cep, 8)}` : '',
        ]
          .filter(Boolean)
          .join(' — '),
      )}</p>
    </div>`
    : '<div class="box"><div class="box-h">Destinatário</div><p class="muted">Não informado</p></div>'

  const rows = data.itens
    .map(
      (it, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(it.descricao)}</td>
      <td class="c">${esc(it.ncm || '—')}</td>
      <td class="c">${esc(it.cfop || '—')}</td>
      <td class="c">${esc(it.unidade)}</td>
      <td class="r">${it.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</td>
      <td class="r">${fmtBrl(it.valorUnitario)}</td>
      <td class="r">${fmtBrl(it.valorTotal)}</td>
    </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DANFE prévia — NF-e ${esc(data.numero)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, Roboto, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 16px; background: #f4f4f5; }
    .page { max-width: 210mm; margin: 0 auto; background: #fff; padding: 14px 16px 20px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
    h1 { font-size: 15px; margin: 0 0 4px; letter-spacing: .02em; }
    .sub { font-size: 11px; color: #555; margin-bottom: 12px; }
    .banner { border: 2px solid #111; padding: 8px 10px; margin-bottom: 10px; text-align: center; font-weight: 700; font-size: 13px; }
    .amb-homologacao { background: #fff3cd; border-color: #856404; color: #533f03; }
    .amb-producao { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    @media (max-width: 720px) { .grid2 { grid-template-columns: 1fr; } }
    .box { border: 1px solid #ccc; padding: 8px 10px; min-height: 72px; }
    .box-h { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #444; margin-bottom: 6px; border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
    .chave { font-family: ui-monospace, Consolas, monospace; font-size: 11px; letter-spacing: .12em; line-height: 1.5; word-break: break-all; }
    .muted { color: #666; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th, td { border: 1px solid #bbb; padding: 5px 6px; vertical-align: top; }
    th { background: #f0f0f0; font-weight: 600; text-align: left; }
    .c { text-align: center; }
    .r { text-align: right; }
    tfoot td { font-weight: 700; background: #fafafa; }
    .foot { margin-top: 14px; font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 8px; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="banner ${data.ambiente === '1' ? 'amb-producao' : 'amb-homologacao'}">
      DANFE — Documento Auxiliar da Nota Fiscal Eletrônica — ${esc(ambLabel)}
    </div>
    <h1>NF-e nº ${esc(data.numero)} · Série ${esc(data.serie)}</h1>
    <p class="sub">${esc(data.naturezaOperacao)}${data.dataEmissao ? ` · Emissão ${esc(data.dataEmissao)}` : ''}</p>

    <div class="grid2">
      <div class="box">
        <div class="box-h">Emitente</div>
        <p><strong>${esc(data.emitente.razaoSocial)}</strong></p>
        <p class="small">CNPJ: ${esc(onlyDigits(data.emitente.cnpj, 14))}${data.emitente.ie ? ` · IE ${esc(data.emitente.ie)}` : ''}</p>
        <p class="small">${esc(endEmit)}</p>
      </div>
      ${destBlock}
    </div>

    <div class="box">
      <div class="box-h">Chave de acesso (44 dígitos)</div>
      <p class="chave">${esc(chaveFormatada44(ch))}</p>
      <p class="muted">Prévia gerada pelo SISCR para conferência. Código de barras gráfico não incluído nesta versão.</p>
    </div>

    <table>
      <thead>
        <tr>
          <th class="c">#</th>
          <th>Descrição</th>
          <th class="c">NCM</th>
          <th class="c">CFOP</th>
          <th class="c">Un</th>
          <th class="r">Qtd</th>
          <th class="r">Vl unit</th>
          <th class="r">Vl total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="7" class="r">Valor total da NF-e</td>
          <td class="r">${fmtBrl(data.valorTotal)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="foot">
      Documento sem valor fiscal — prévia para testes internos. Transmita e autorize na SEFAZ para validade jurídica.
    </div>
  </div>
</body>
</html>`
}
