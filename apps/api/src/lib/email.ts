/**
 * Módulo de envio de e-mail via Resend.
 * Todas as funções recebem env como parâmetro para compatibilidade com Cloudflare Workers.
 */

interface EmailEnv {
  RESEND_API_KEY: string
  EMAIL_FROM: string
  FRONTEND_URL: string
}

async function sendEmail(env: EmailEnv, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[Email] Falha ao enviar:', err)
    throw new Error(`Resend error: ${res.status}`)
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
