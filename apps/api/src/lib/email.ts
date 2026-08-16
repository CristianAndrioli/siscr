/**
 * Envio de e-mail transacional via Cloudflare Email Service (`env.EMAIL.send`).
 * Sem API key de terceiro: o remetente precisa estar no domínio onboardado
 * (Compute → Email Service → Email Sending → Onboard Domain).
 */

export type EmailAddress = { email: string; name?: string }

export type SendEmailBinding = {
  send(message: {
    to: string | EmailAddress | Array<string | EmailAddress>
    from: string | EmailAddress
    subject: string
    html?: string
    text?: string
  }): Promise<{ messageId: string }>
}

export interface EmailEnv {
  EMAIL?: SendEmailBinding
  EMAIL_FROM?: string
  FRONTEND_URL?: string
  SUPPORT_DESK_URL?: string
}

const DEFAULT_FROM: EmailAddress = { name: 'SISCR', email: 'noreply@siscr.com.br' }

export function hasEmailBinding<T extends { EMAIL?: SendEmailBinding }>(
  env: T,
): env is T & { EMAIL: SendEmailBinding } {
  return typeof env.EMAIL?.send === 'function'
}

function parseFrom(raw?: string): EmailAddress {
  if (!raw?.trim()) return DEFAULT_FROM
  const named = raw.match(/^\s*(.+?)\s*<([^>]+)>\s*$/)
  if (named) {
    return { name: named[1]!.replace(/^["']|["']$/g, '').trim(), email: named[2]!.trim() }
  }
  return { email: raw.trim() }
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function sendEmail(env: EmailEnv, to: string | string[], subject: string, html: string): Promise<void> {
  if (!hasEmailBinding(env)) {
    throw new Error('Binding EMAIL ausente. Configure [[send_email]] no wrangler.toml.')
  }
  try {
    await env.EMAIL.send({
      from: parseFrom(env.EMAIL_FROM),
      to,
      subject,
      html,
      text: htmlToText(html),
    })
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : ''
    console.error('[Email] Falha ao enviar:', code || err)
    throw err
  }
}

// ─── Templates ────────────────────────────────────────────────

function baseTemplate(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; margin: 0; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; max-width: 520px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .logo { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 28px; }
    .logo span { color: #6366f1; }
    h1 { font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 12px; }
    p { font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 20px; }
    .btn { display: inline-block; background: #6366f1; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
    .muted { font-size: 13px; color: #94a3b8; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SISC<span>R</span></div>
    ${content}
    <hr class="divider"/>
    <p class="muted">Este e-mail foi enviado automaticamente. Não responda a esta mensagem.</p>
  </div>
</body>
</html>`
}

// ─── Verificação de e-mail ─────────────────────────────────────

export async function sendEmailVerification(
  env: EmailEnv,
  to: string,
  nome: string,
  token: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/verify-email?token=${token}`
  const html = baseTemplate('Confirme seu e-mail — SISCR', `
    <h1>Confirme seu e-mail</h1>
    <p>Olá, <strong>${nome}</strong>!</p>
    <p>Clique no botão abaixo para confirmar seu endereço de e-mail e continuar com o cadastro:</p>
    <a href="${link}" class="btn">Confirmar e-mail</a>
    <p>O link expira em <strong>24 horas</strong>.</p>
    <p class="muted">Se você não solicitou este cadastro, ignore este e-mail.</p>
  `)
  await sendEmail(env, to, 'Confirme seu e-mail — SISCR', html)
}

// ─── Boas-vindas (pós-pagamento) ───────────────────────────────

export async function sendWelcomeEmail(
  env: EmailEnv,
  to: string,
  nome: string,
  tenantSlug: string,
  plan: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/login`
  const planLabel: Record<string, string> = {
    free: 'Free',
    basico: 'Básico',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  const html = baseTemplate('Bem-vindo ao SISCR!', `
    <h1>Conta criada com sucesso! 🎉</h1>
    <p>Olá, <strong>${nome}</strong>!</p>
    <p>Sua conta no SISCR foi criada no plano <strong>${planLabel[plan] ?? plan}</strong>. Seu identificador de empresa é <strong>${tenantSlug}</strong>.</p>
    <a href="${link}" class="btn">Acessar o SISCR</a>
    <p>Se tiver qualquer dúvida, responda este e-mail que nossa equipe te ajuda.</p>
  `)
  await sendEmail(env, to, 'Bem-vindo ao SISCR!', html)
}

// ─── Recuperação de senha ──────────────────────────────────────

export async function sendPasswordResetEmail(
  env: EmailEnv,
  to: string,
  nome: string,
  userId: string,
  token: string,
): Promise<void> {
  const link = `${env.FRONTEND_URL}/reset-password/${userId}/${token}`
  const html = baseTemplate('Redefinição de senha — SISCR', `
    <h1>Redefinir senha</h1>
    <p>Olá, <strong>${nome}</strong>!</p>
    <p>Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo:</p>
    <a href="${link}" class="btn">Redefinir senha</a>
    <p>O link expira em <strong>1 hora</strong>.</p>
    <p class="muted">Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.</p>
  `)
  await sendEmail(env, to, 'Redefinição de senha — SISCR', html)
}

export async function sendSupportTicketEmail(
  env: EmailEnv,
  to: string[],
  data: {
    subject: string
    ticketId: string
    tenantNome: string
    tenantSlug: string
    userNome: string
    userEmail: string
  },
): Promise<void> {
  if (to.length === 0) return
  const link = `${env.SUPPORT_DESK_URL ?? 'https://suporte-staging.siscr.com.br'}/tickets/${data.ticketId}`
  const html = baseTemplate('Novo chamado SISCR', `
    <h1>Novo chamado de suporte</h1>
    <p><strong>${escapeHtml(data.subject)}</strong></p>
    <p>Cliente: <strong>${escapeHtml(data.tenantNome)}</strong> (@${escapeHtml(data.tenantSlug)})</p>
    <p>Usuário: ${escapeHtml(data.userNome)} (${escapeHtml(data.userEmail)})</p>
    <a href="${link}" class="btn">Abrir no painel</a>
  `)
  await sendEmail(env, to, `[SISCR] ${data.subject}`, html)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
