# 🧪 Teste da Recuperação de Senha

## ✅ O que foi implementado

### 1. Backend - Endpoints
- ✅ `POST /api/auth/password-reset/` - Solicita reset de senha
- ✅ `POST /api/auth/password-reset-confirm/` - Confirma reset de senha

### 2. Frontend - Páginas
- ✅ `/forgot-password` - Página para solicitar reset
- ✅ `/reset-password/:uid/:token` - Página para redefinir senha
- ✅ Link "Esqueci minha senha" na página de login

### 3. Configuração de Email
- ✅ Settings configurados para email
- ✅ Console backend para desenvolvimento
- ✅ Suporte a SMTP para produção

---

## 🧪 Como Testar

### 1. Testar Solicitação de Reset

**Via Frontend:**
1. Acesse: `http://localhost:5173/forgot-password`
2. Digite o email do usuário
3. Clique em "Enviar Link de Recuperação"
4. Verifique o console do Django (email será exibido lá)

**Via API:**
```bash
POST http://localhost:8000/api/auth/password-reset/
Headers: Content-Type: application/json
Body: {
  "email": "admin@teste.com"
}
```

**Resposta:**
```json
{
  "message": "Se o email existir, você receberá instruções para redefinir sua senha."
}
```

### 2. Verificar Email (Desenvolvimento)

No console do Django, você verá algo como:
```
Content-Type: text/plain; charset="utf-8"
MIME-Version: 1.0
Content-Transfer-Encoding: 7bit
Subject: Redefinição de Senha - SISCR
From: SISCR <noreply@siscr.com.br>
To: admin@teste.com
Date: ...

Olá,

Você solicitou a redefinição de senha para sua conta no SISCR.

Clique no link abaixo para redefinir sua senha:
http://localhost:5173/reset-password/<uid>/<token>/

Este link é válido por 24 horas.
...
```

### 3. Testar Redefinição de Senha

**Via Frontend:**
1. Copie o link do email (ou console)
2. Acesse: `http://localhost:5173/reset-password/<uid>/<token>/`
3. Digite a nova senha (mínimo 8 caracteres)
4. Confirme a senha
5. Clique em "Redefinir Senha"

**Via API:**
```bash
POST http://localhost:8000/api/auth/password-reset-confirm/
Headers: Content-Type: application/json
Body: {
  "uid": "<uid_do_email>",
  "token": "<token_do_email>",
  "new_password": "novaSenha123"
}
```

**Resposta (sucesso):**
```json
{
  "message": "Senha redefinida com sucesso"
}
```

---

## 🔍 Fluxo Completo

1. **Usuário esquece senha**
   - Acessa `/forgot-password`
   - Digita email
   - Clica em "Enviar Link"

2. **Sistema envia email**
   - Gera token temporário
   - Envia email com link
   - Link válido por 24 horas

3. **Usuário clica no link**
   - É redirecionado para `/reset-password/:uid/:token`
   - Página valida token

4. **Usuário redefine senha**
   - Digita nova senha
   - Confirma senha
   - Sistema atualiza senha em ambos schemas (público e tenant)

5. **Redirecionamento**
   - Após sucesso, redireciona para `/login`
   - Usuário pode fazer login com nova senha

---

## ⚠️ Importante

### Identificação de Tenant

O reset de senha precisa identificar o tenant pela URL:
- Acesse através do domínio do tenant
- Ex: `http://teste123.localhost:8000/api/auth/password-reset/`

### Senha Atualizada em Dois Lugares

A senha é atualizada em:
1. **Schema público** - Para autenticação geral
2. **Schema do tenant** - Para autenticação dentro do tenant

### Segurança

- Token válido por 24 horas (padrão Django)
- Sempre retorna sucesso (não revela se email existe)
- Validação de força de senha (mínimo 8 caracteres)
- Token único e seguro

---

## 🐛 Problemas Conhecidos

### Erro: "Tenant não identificado"
**Causa**: Acessando URL sem identificar tenant
**Solução**: Acesse através do domínio/subdomínio do tenant

### Email não chega
**Causa**: Email backend configurado como console
**Solução**: 
- Em desenvolvimento: Verifique o console do Django
- Em produção: Configure SMTP no settings.py

### Token inválido
**Causa**: Token expirado ou já usado
**Solução**: Solicite novo reset de senha

---

## ✅ Checklist de Funcionalidades

- [x] Endpoint de solicitação de reset
- [x] Endpoint de confirmação de reset
- [x] Geração de token seguro
- [x] Envio de email
- [x] Página frontend de solicitação
- [x] Página frontend de redefinição
- [x] Link na página de login
- [x] Validação de senha
- [x] Atualização em ambos schemas
- [x] Redirecionamento após sucesso

---

**Última atualização**: 2025-11-14

