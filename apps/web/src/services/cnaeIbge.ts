/**
 * CNAE subclasse (7 dígitos) via API pública do IBGE.
 * Doc: https://servicodados.ibge.gov.br/api/docs/CNAE?versao=2
 *
 * Com `VITE_API_URL` definido, usa o proxy `/api/public/cnae` no Worker (evita CORS).
 */

const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '';

export type CnaeSubclasseInfo = {
  /** Mesmo código de 7 dígitos enviado */
  codigo: string;
  descricao: string;
};

type IbgeSubclasseJson = {
  id?: string;
  descricao?: string;
};

/** Extrai até 7 dígitos do texto (aceita máscara 0000-0/00). */
export function cnaeDigitsFromInput(input: string): string {
  return input.replace(/\D/g, '').slice(0, 7);
}

/** Formato usual de exibição: 6201501 → 6201-5/01 (parcial enquanto digita). */
export function formatCnaeMascara(digits7: string): string {
  const d = digits7.replace(/\D/g, '').slice(0, 7);
  if (d.length <= 4) return d;
  if (d.length === 5) return `${d.slice(0, 4)}-${d[4]}`;
  if (d.length === 6) return `${d.slice(0, 4)}-${d[4]}/${d[5]}`;
  return `${d.slice(0, 4)}-${d[4]}/${d.slice(5, 7)}`;
}

/**
 * Busca descrição oficial da subclasse CNAE (7 dígitos).
 * Retorna null se código inválido, não encontrado ou erro de rede/CORS.
 */
export async function fetchCnaeSubclassePorCodigo(digits7: string): Promise<CnaeSubclasseInfo | null> {
  const codigo = cnaeDigitsFromInput(digits7);
  if (codigo.length !== 7) return null;

  try {
    const url = API_BASE
      ? `${API_BASE.replace(/\/$/, '')}/api/public/cnae/${encodeURIComponent(codigo)}`
      : `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/${encodeURIComponent(codigo)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as IbgeSubclasseJson;
    const id = data.id != null ? String(data.id).replace(/\D/g, '').slice(0, 7) : '';
    const descricao = (data.descricao ?? '').trim();
    if (!id || id.length !== 7 || !descricao) return null;
    return { codigo: id, descricao };
  } catch {
    return null;
  }
}
