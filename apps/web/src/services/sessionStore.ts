/**
 * SessionStore — camada única para ler/escrever sessão no frontend.
 *
 * Motivação
 * -----------------------------------------------------------------
 * Antes desta classe, chamadas `localStorage.getItem('access_token')`
 * e similares estavam espalhadas pelo app (auth.ts, HttpClient,
 * Layout, Perfil, hooks). Qualquer decisão global — trocar chave,
 * migrar para cookies HttpOnly, usar sessionStorage temporário —
 * exigia `grep` em dezenas de arquivos.
 *
 * Este módulo concentra TODAS as operações de sessão num único
 * ponto: `SessionStore`. Consumidores dependem apenas da API pública
 * (`getToken()`, `save()`, `clear()`, ...), não do backend de
 * armazenamento.
 *
 * Camada de armazenamento atual
 * -----------------------------------------------------------------
 * Hoje usa `localStorage` porque o token é um opaque random ID
 * validado por Workers KV server-side (i.e. roubar o token só vale
 * até ele ser revogado). Ainda assim, XSS consegue lê-lo.
 *
 * Caminho para HttpOnly cookies (futuro)
 * -----------------------------------------------------------------
 * Para mitigar XSS, o token deve migrar para cookie HttpOnly +
 * SameSite=Strict + Secure. O plano é:
 *
 *   1. Backend (`apps/api/src/routes/auth.ts`):
 *      - No login, além de devolver `{ token }`, setar
 *        `Set-Cookie: siscr_session=<token>; HttpOnly; Secure;
 *         SameSite=Strict; Path=/; Max-Age=604800`.
 *      - `authMiddleware` aceita token via cookie OU Authorization
 *        header (compat). Preferir o cookie.
 *      - No logout, `Set-Cookie: siscr_session=; Max-Age=0`.
 *
 *   2. Frontend (este arquivo):
 *      - Remover `saveToken/clearToken` — o browser gere tudo.
 *      - `SiscrHttpClient` passa a enviar `credentials: 'include'`
 *        (ou `withCredentials: true` no axios).
 *      - `isAuthenticated()` vira uma chamada async a /auth/me em
 *        vez de checar token localmente (ou mantemos um flag não-
 *        sensível "has_session" em localStorage).
 *
 *   3. CORS (`apps/api/src/index.ts`):
 *      - Allow-Credentials + Origin explícito (não '*').
 *
 *   4. Tenant slug, user_nome, user metadata continuam em
 *      localStorage (não são credenciais; são hints de UI).
 *
 * Até lá, a API abaixo é estável — a migração será transparente
 * para os callers.
 */

export interface SessionUserSnapshot {
  id: string
  email: string
  nome?: string
  role: string
  modules?: Record<string, { view: boolean; edit: boolean }>
  customRoleId?: string | null
}

export interface SessionTenantSnapshot {
  id: string
  slug: string
  nome?: string
  status: string
}

export interface SessionSnapshot {
  token: string
  user: SessionUserSnapshot
  tenant: SessionTenantSnapshot
}

/** Chaves internas — NÃO ler direto do localStorage fora deste módulo. */
const KEYS = {
  token: 'access_token',
  tenantSlug: 'tenant_slug',
  tenantStatus: 'tenant_status',
  user: 'user',
  userNome: 'user_nome',
} as const

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * API pública. Pensada como módulo (não classe) para callers que só
 * querem uma função — mas se alguém quiser mock, basta trocar pelo
 * mesmo shape via injeção no teste.
 */
export const sessionStore = {
  /** Token opaque validado server-side. `null` quando deslogado. */
  getToken(): string | null {
    return localStorage.getItem(KEYS.token)
  },

  /** Slug do tenant atual (usado em `X-Tenant-Slug` pelo HttpClient). */
  getTenantSlug(): string | null {
    return localStorage.getItem(KEYS.tenantSlug)
  },

  /** Status cache do tenant — 'active' | 'suspended' | etc. */
  getTenantStatus(): string | null {
    return localStorage.getItem(KEYS.tenantStatus)
  },

  /** Exposição de cache local do usuário — apenas para UI. */
  getLocalUser(): SessionUserSnapshot | null {
    return safeParse<SessionUserSnapshot>(localStorage.getItem(KEYS.user))
  },

  /** Nome do usuário para exibição rápida sem parse. */
  getUserNome(): string | null {
    return localStorage.getItem(KEYS.userNome)
  },

  /** True quando há token; validação de verdade é server-side. */
  isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(KEYS.token))
  },

  /** Persiste sessão após login/auto-login. */
  save(snapshot: SessionSnapshot): void {
    localStorage.setItem(KEYS.token, snapshot.token)
    localStorage.setItem(KEYS.tenantSlug, snapshot.tenant.slug)
    localStorage.setItem(KEYS.tenantStatus, snapshot.tenant.status ?? 'active')
    localStorage.setItem(KEYS.user, JSON.stringify(snapshot.user))
    localStorage.setItem(KEYS.userNome, snapshot.user.nome || snapshot.user.email || '')
  },

  /** Atualiza apenas o status do tenant (ex.: webhook marca suspended). */
  setTenantStatus(status: string): void {
    localStorage.setItem(KEYS.tenantStatus, status)
  },

  /** Atualiza cache do nome (ex.: tela "Meu perfil" editou nome). */
  setUserNome(nome: string): void {
    localStorage.setItem(KEYS.userNome, nome)
  },

  /** Atualiza snapshot completo do user (sem tocar no tenant/token). */
  setLocalUser(user: SessionUserSnapshot): void {
    localStorage.setItem(KEYS.user, JSON.stringify(user))
    if (user.nome || user.email) {
      localStorage.setItem(KEYS.userNome, user.nome || user.email)
    }
  },

  /** Limpa tudo relacionado à sessão. Usado em logout e 401. */
  clear(): void {
    localStorage.removeItem(KEYS.token)
    localStorage.removeItem(KEYS.tenantSlug)
    localStorage.removeItem(KEYS.tenantStatus)
    localStorage.removeItem(KEYS.user)
    localStorage.removeItem(KEYS.userNome)
  },
}
