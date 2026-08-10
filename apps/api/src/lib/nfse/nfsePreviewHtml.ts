/** Prévia visual DANFSe — não substitui o documento oficial da prefeitura. */

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

export type NfsePreviewEmitente = {
  razaoSocial: string
  cnpj: string
  im?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

export type NfsePreviewTomador = {
  nome: string
  doc: string
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

export type NfsePreviewInput = {
  numero: string
  serie: string
  ambiente: string
  protocolo?: string | null
  dataEmissao?: string | null
  dataAutorizacao?: string | null
  codigoServico?: string | null
  descricaoServico: string
  aliquotaIss?: number | null
  valorIss?: number | null
  valorServicos: number
  emitente: NfsePreviewEmitente
  tomador: NfsePreviewTomador | null
}

export function buildNfsePreviewHtml(data: NfsePreviewInput): string {
  const ambLabel = data.ambiente === '1' ? 'Produção' : 'Homologação'
  const endEmit = [
    [data.emitente.logradouro, data.emitente.numero].filter(Boolean).join(', '),
    data.emitente.bairro,
    [data.emitente.cidade, data.emitente.uf].filter(Boolean).join(' / '),
    data.emitente.cep ? `CEP ${onlyDigits(data.emitente.cep, 8)}` : '',
  ]
    .filter(Boolean)
    .join(' — ')

  const tomadorBlock = data.tomador
    ? `
    <div class="box">
      <div class="box-h">Tomador de serviços</div>
      <p><strong>${esc(data.tomador.nome)}</strong></p>
      <p class="small">CNPJ/CPF: ${esc(onlyDigits(data.tomador.doc, 14) || '—')}</p>
      <p class="small">${esc(
        [
          [data.tomador.logradouro, data.tomador.numero].filter(Boolean).join(', '),
          data.tomador.bairro,
          [data.tomador.cidade, data.tomador.uf].filter(Boolean).join(' / '),
          data.tomador.cep ? `CEP ${onlyDigits(data.tomador.cep, 8)}` : '',
        ]
          .filter(Boolean)
          .join(' — ') || '—',
      )}</p>
    </div>`
    : '<div class="box"><div class="box-h">Tomador de serviços</div><p class="muted">Não informado</p></div>'

  const aliq =
    data.aliquotaIss != null && Number.isFinite(data.aliquotaIss)
      ? `${data.aliquotaIss.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`
      : '—'
  const vIss =
    data.valorIss != null && Number.isFinite(data.valorIss) ? fmtBrl(data.valorIss) : '—'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DANFSe prévia — NFS-e ${esc(data.numero)}/${esc(data.serie)}</title>
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
    .muted { color: #666; font-size: 11px; }
    .small { font-size: 11px; margin: 2px 0; }
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
      DANFSe — Documento Auxiliar da NFS-e — ${esc(ambLabel)}
    </div>
    <h1>NFS-e nº ${esc(data.numero)} · Série ${esc(data.serie)}</h1>
    <p class="sub">
      ${data.dataEmissao ? `Emissão ${esc(data.dataEmissao)}` : 'Emissão —'}
      ${data.dataAutorizacao ? ` · Autorização ${esc(data.dataAutorizacao)}` : ''}
      ${data.protocolo ? ` · Protocolo/Nº ${esc(data.protocolo)}` : ''}
    </p>

    <div class="grid2">
      <div class="box">
        <div class="box-h">Prestador de serviços</div>
        <p><strong>${esc(data.emitente.razaoSocial)}</strong></p>
        <p class="small">CNPJ: ${esc(onlyDigits(data.emitente.cnpj, 14))}${
          data.emitente.im ? ` · IM ${esc(data.emitente.im)}` : ''
        }</p>
        <p class="small">${esc(endEmit)}</p>
      </div>
      ${tomadorBlock}
    </div>

    <div class="box">
      <div class="box-h">Serviço</div>
      <p class="small"><strong>Código:</strong> ${esc(data.codigoServico || '—')}</p>
      <p>${esc(data.descricaoServico || '—')}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th class="c">Alíq. ISS</th>
          <th class="r">Valor ISS</th>
          <th class="r">Valor dos serviços</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(data.descricaoServico || 'Prestação de serviços')}</td>
          <td class="c">${esc(aliq)}</td>
          <td class="r">${esc(vIss)}</td>
          <td class="r">${fmtBrl(data.valorServicos)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" class="r">Valor total da NFS-e</td>
          <td class="r">${fmtBrl(data.valorServicos)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="foot">
      Documento sem valor fiscal — prévia para conferência interna no SISCR.
      A NFS-e oficial é emitida/consultada no portal da prefeitura após autorização.
    </div>
  </div>
</body>
</html>`
}
