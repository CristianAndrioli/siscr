import api from './api'

const BASE = '/tenant/conexoes'

export type ConexaoTipo = 'http' | 'dominio' | 'onvio' | 'alterdata' | 'sefaz_dfe'
export type ConexaoAuthTipo = 'none' | 'basic' | 'bearer' | 'api_key_header'

export interface Conexao {
  id: string
  nome: string
  descricao: string | null
  tipo: ConexaoTipo
  base_url: string
  auth_tipo: ConexaoAuthTipo
  auth_config: { username?: string; headerName?: string } | null
  tem_segredo: boolean
  empresa_id: string | null
  ativo: 0 | 1
  ultimo_teste_em: string | null
  ultimo_teste_status: 'ok' | 'erro' | null
  ultimo_teste_detalhe: string | null
}

export interface ConexaoInput {
  nome: string
  descricao?: string | null
  tipo: ConexaoTipo
  baseUrl: string
  authTipo: ConexaoAuthTipo
  authConfig?: { username?: string; headerName?: string } | null
  /** Só enviado na criação ou ao trocar o segredo. */
  secret?: string | null
  ativo?: boolean
}

export const conexoesService = {
  listar: async (): Promise<Conexao[]> => {
    const res = await api.get(BASE)
    return (res.data as { conexoes: Conexao[] }).conexoes
  },
  criar: async (input: ConexaoInput): Promise<Conexao> => {
    const res = await api.post(BASE, input)
    return (res.data as { conexao: Conexao }).conexao
  },
  atualizar: async (id: string, input: Partial<ConexaoInput>): Promise<Conexao> => {
    const res = await api.put(`${BASE}/${id}`, input)
    return (res.data as { conexao: Conexao }).conexao
  },
  remover: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`)
  },
  testar: async (id: string): Promise<{ status: 'ok' | 'erro'; detalhe: string; testado_em: string }> => {
    const res = await api.post(`${BASE}/${id}/testar`)
    return res.data as { status: 'ok' | 'erro'; detalhe: string; testado_em: string }
  },
}
