/**
 * OFX / QFX parser (browser-side, no server cost)
 * Supports OFX 1.x (SGML) and OFX 2.x (XML) formats used by Brazilian banks.
 */

export interface OFXTransaction {
  fitid: string;
  tipo: 'credito' | 'debito';
  valor: number;
  data: string; // YYYY-MM-DD
  descricao: string;
  raw: {
    trntype: string;
    dtposted: string;
    trnamt: string;
    memo?: string;
    name?: string;
  };
}

export interface OFXBankInfo {
  bankid?: string;
  acctid?: string;
  accttype?: string;
}

export interface OFXResult {
  bank: OFXBankInfo;
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string;   // YYYY-MM-DD
  balAmount?: number; // LEDGERBAL
  transactions: OFXTransaction[];
  currency?: string;
}

export class OFXParseError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'OFXParseError';
  }
}

// ─── Date helpers ─────────────────────────────────────────────────

function ofxDateToISO(raw: string): string {
  // OFX dates: 20240115 | 20240115120000 | 20240115120000[-03:BRT]
  const clean = raw.trim().replace(/\[.*\]$/, '');
  const digits = clean.replace(/\D/g, '');
  if (digits.length < 8) throw new OFXParseError(`Invalid OFX date: ${raw}`);
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function trnTypeToTipo(trntype: string): 'credito' | 'debito' {
  // CREDIT, DEP, INT, DIV, REFUND → credito
  // DEBIT, ATM, POS, XFER, CHECK, PAYMENT, CASH, DIRECTDEBIT, FEE → debito
  const credits = ['CREDIT', 'DEP', 'INT', 'DIV', 'REFUND', 'DIRECTDEP'];
  return credits.includes(trntype.toUpperCase()) ? 'credito' : 'debito';
}

// ─── OFX 1.x SGML parser ──────────────────────────────────────────

function parseOFX1(text: string): OFXResult {
  // Strip header (everything before <OFX>)
  const bodyStart = text.indexOf('<OFX>');
  if (bodyStart === -1) throw new OFXParseError('Não encontrado bloco <OFX>');
  const body = text.slice(bodyStart);

  function getTag(tag: string, scope: string): string | undefined {
    const re = new RegExp(`<${tag}>([^<\n\r]*)`, 'i');
    const m = scope.match(re);
    return m ? m[1].trim() : undefined;
  }

  function getAllBlocks(tag: string, scope: string): string[] {
    const blocks: string[] = [];
    const openTag = new RegExp(`<${tag}>`, 'gi');
    const closeTag = new RegExp(`</${tag}>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = openTag.exec(scope)) !== null) {
      const start = match.index + match[0].length;
      closeTag.lastIndex = start;
      const end = closeTag.exec(scope);
      if (end) blocks.push(scope.slice(start, end.index));
    }
    return blocks;
  }

  const bank: OFXBankInfo = {
    bankid: getTag('BANKID', body),
    acctid: getTag('ACCTID', body),
    accttype: getTag('ACCTTYPE', body),
  };

  const dtstart = getTag('DTSTART', body);
  const dtend = getTag('DTEND', body);
  const ledgerbal = getTag('BALAMT', body);
  const currency = getTag('CURSYM', body) ?? getTag('CURDEF', body);

  const stmttrn = getAllBlocks('STMTTRN', body);
  const transactions: OFXTransaction[] = [];

  for (const block of stmttrn) {
    const trntype = getTag('TRNTYPE', block);
    const dtposted = getTag('DTPOSTED', block);
    const trnamt = getTag('TRNAMT', block);
    const fitid = getTag('FITID', block);
    const memo = getTag('MEMO', block);
    const name = getTag('NAME', block);

    if (!trntype || !dtposted || !trnamt || !fitid) continue;

    const valor = Math.abs(parseFloat(trnamt.replace(',', '.')));
    if (isNaN(valor) || valor === 0) continue;

    transactions.push({
      fitid,
      tipo: trnTypeToTipo(trntype),
      valor,
      data: ofxDateToISO(dtposted),
      descricao: memo ?? name ?? trntype,
      raw: { trntype, dtposted, trnamt, memo, name },
    });
  }

  if (transactions.length === 0) {
    throw new OFXParseError('Nenhuma transação encontrada no arquivo OFX.');
  }

  return {
    bank,
    dateStart: dtstart ? ofxDateToISO(dtstart) : undefined,
    dateEnd: dtend ? ofxDateToISO(dtend) : undefined,
    balAmount: ledgerbal ? parseFloat(ledgerbal.replace(',', '.')) : undefined,
    currency,
    transactions,
  };
}

// ─── OFX 2.x XML parser ───────────────────────────────────────────

function parseOFX2(text: string): OFXResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) throw new Error(parseErr.textContent ?? 'XML parse error');
  } catch (e) {
    throw new OFXParseError(`Erro ao analisar OFX 2.x XML: ${(e as Error).message}`);
  }

  function txt(parent: Element | Document, tag: string): string | undefined {
    return parent.querySelector(tag)?.textContent?.trim() ?? undefined;
  }

  const bank: OFXBankInfo = {
    bankid: txt(doc, 'BANKID'),
    acctid: txt(doc, 'ACCTID'),
    accttype: txt(doc, 'ACCTTYPE'),
  };

  const dtstart = txt(doc, 'DTSTART');
  const dtend = txt(doc, 'DTEND');
  const ledgerbal = txt(doc, 'BALAMT');
  const currency = txt(doc, 'CURSYM') ?? txt(doc, 'CURDEF');

  const stmttrnNodes = doc.querySelectorAll('STMTTRN');
  const transactions: OFXTransaction[] = [];

  for (const node of Array.from(stmttrnNodes)) {
    const trntype = txt(node, 'TRNTYPE');
    const dtposted = txt(node, 'DTPOSTED');
    const trnamt = txt(node, 'TRNAMT');
    const fitid = txt(node, 'FITID');
    const memo = txt(node, 'MEMO');
    const name = txt(node, 'NAME');

    if (!trntype || !dtposted || !trnamt || !fitid) continue;

    const valor = Math.abs(parseFloat(trnamt.replace(',', '.')));
    if (isNaN(valor) || valor === 0) continue;

    transactions.push({
      fitid,
      tipo: trnTypeToTipo(trntype),
      valor,
      data: ofxDateToISO(dtposted),
      descricao: memo ?? name ?? trntype,
      raw: { trntype, dtposted, trnamt, memo, name },
    });
  }

  if (transactions.length === 0) {
    throw new OFXParseError('Nenhuma transação encontrada no arquivo OFX.');
  }

  return {
    bank,
    dateStart: dtstart ? ofxDateToISO(dtstart) : undefined,
    dateEnd: dtend ? ofxDateToISO(dtend) : undefined,
    balAmount: ledgerbal ? parseFloat(ledgerbal.replace(',', '.')) : undefined,
    currency,
    transactions,
  };
}

// ─── Public API ────────────────────────────────────────────────────

export function parseOFX(text: string): OFXResult {
  // Detect format: OFX 2.x starts with <?xml or <OFX xmlns
  const trimmed = text.trim();
  const isXml = trimmed.startsWith('<?xml') || /<OFX\s+xmlns/i.test(trimmed.slice(0, 200));
  return isXml ? parseOFX2(trimmed) : parseOFX1(trimmed);
}

export function parseOFXFile(file: File): Promise<OFXResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        resolve(parseOFX(text));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new OFXParseError('Erro ao ler o arquivo.'));
    // Try UTF-8 first, fall back to latin1 (common in Brazilian OFX files)
    reader.readAsText(file, 'utf-8');
  });
}

// ─── Summary helpers ────────────────────────────────────────────────

export function ofxSummary(result: OFXResult) {
  const creditos = result.transactions.filter(t => t.tipo === 'credito');
  const debitos  = result.transactions.filter(t => t.tipo === 'debito');
  return {
    total: result.transactions.length,
    totalCreditos: creditos.length,
    totalDebitos: debitos.length,
    valorCreditos: creditos.reduce((s, t) => s + t.valor, 0),
    valorDebitos:  debitos.reduce((s, t) => s + t.valor, 0),
  };
}
