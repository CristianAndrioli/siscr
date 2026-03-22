import { useSearchParams, Link } from 'react-router-dom';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || '';
  const isFree = searchParams.get('free') === '1';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center animate-slide-up">
        {/* Ícone de sucesso */}
        <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center text-4xl mx-auto mb-6">
          🎉
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-3">
          {isFree ? 'Conta criada!' : 'Pagamento confirmado!'}
        </h1>
        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          {isFree
            ? 'Sua conta gratuita está pronta. Faça login para começar.'
            : 'Sua assinatura foi processada. Seu ambiente está sendo configurado.'}
        </p>

        {tenantSlug && (
          <div className="card-dark border border-surface-border p-5 mb-8 text-left">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Suas credenciais de acesso</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Identificador:</span>
                <code className="text-brand-300 font-mono text-sm font-semibold">@{tenantSlug}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">URL de acesso:</span>
                <code className="text-brand-300 font-mono text-xs">/login</code>
              </div>
            </div>
          </div>
        )}

        <Link
          to={`/login${tenantSlug ? `?tenant=${tenantSlug}` : ''}`}
          className="btn-primary w-full py-4 text-base mb-4"
        >
          Acessar o sistema →
        </Link>

        <Link to="/" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
