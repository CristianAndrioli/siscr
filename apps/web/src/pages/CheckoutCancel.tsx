import { Link } from 'react-router-dom';

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center animate-slide-up">
        <div className="w-20 h-20 rounded-full bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center text-4xl mx-auto mb-6">
          ↩️
        </div>

        <h1 className="font-display text-3xl font-bold text-white mb-3">
          Pagamento cancelado
        </h1>
        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          Nenhuma cobrança foi realizada. Você pode tentar novamente quando quiser.
        </p>

        <Link to="/plans" className="btn-primary w-full py-4 text-base mb-4">
          Escolher um plano
        </Link>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
