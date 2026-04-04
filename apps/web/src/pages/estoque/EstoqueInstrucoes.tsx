export function EstoqueInstrucoes() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Como funciona o Estoque</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Entenda a lógica de locais, movimentações e transferências para gerenciar seu estoque com precisão.</p>
      </div>

      {/* Visão Geral */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Visão Geral</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          O módulo de estoque controla a <strong>quantidade de produtos por local físico</strong>. Cada produto pode estar em múltiplos locais ao mesmo tempo, com saldos independentes.
          A <strong>Posição Atual</strong> mostra o saldo consolidado de cada produto por local.
        </p>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm font-mono text-slate-700 dark:text-slate-300 space-y-1">
          <div>Produto: Caneta Azul</div>
          <div className="pl-4 text-emerald-600 dark:text-emerald-400">→ GERAL: 50 unidades</div>
          <div className="pl-4 text-emerald-600 dark:text-emerald-400">→ LOJA-CENTRO: 20 unidades</div>
          <div className="pl-4 text-emerald-600 dark:text-emerald-400">→ DEPOSITO: 130 unidades</div>
        </div>
      </section>

      {/* Locais */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Locais</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Locais são os <strong>pontos físicos onde os produtos são armazenados</strong>: lojas, depósitos, almoxarifados, armazéns ou estoques externos.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">1</span>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Local padrão: GERAL</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Todo estoque novo é registrado em "GERAL" por padrão. Não precisa ser criado.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">2</span>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cadastrando locais</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Na tela "Locais", cadastre os pontos de estoque da sua empresa (ex: DEPOSITO, LOJA-SP, ALMOX-01). O nome aparecerá nas sugestões dos formulários.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">3</span>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nomes em maiúsculas</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Os nomes dos locais são sempre em maiúsculas (ex: GERAL, DEPOSITO-A). Use nomes curtos e descritivos.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Movimentações */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Movimentações</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Movimentações registram <strong>entradas, saídas e ajustes</strong> de estoque em um local específico.
          Cada movimentação atualiza automaticamente o saldo na Posição Atual.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">+</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">Entrada</span>
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Aumenta o saldo no local. Use para compras, recebimento de mercadorias, devolução de clientes.</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">−</span>
              <span className="font-bold text-red-700 dark:text-red-300 text-sm">Saída</span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">Diminui o saldo no local. Use para vendas, consumo interno, devoluções a fornecedor.</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">≈</span>
              <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">Ajuste</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">Corrige o saldo após inventário físico. Pode somar ou subtrair dependendo do valor informado.</p>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 flex gap-2 items-start">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>Movimentações não podem ser editadas ou excluídas após registro para garantir a rastreabilidade do estoque. Para corrigir um erro, registre um ajuste.</span>
        </div>
      </section>

      {/* Transferências */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Transferências</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Uma transferência move produtos <strong>entre dois locais</strong> de forma atômica: o sistema debita o saldo na origem e credita no destino simultaneamente,
          garantindo que nenhum produto seja "perdido" na operação.
        </p>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Exemplo de transferência</p>
          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1 bg-red-100 dark:bg-red-950 rounded-lg p-2 text-center">
              <div className="text-xs text-red-500 dark:text-red-400 font-medium">DEPOSITO</div>
              <div className="font-bold text-red-700 dark:text-red-300">−10 un</div>
            </div>
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <div className="flex-1 bg-emerald-100 dark:bg-emerald-950 rounded-lg p-2 text-center">
              <div className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">LOJA-CENTRO</div>
              <div className="font-bold text-emerald-700 dark:text-emerald-300">+10 un</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">O saldo total da empresa permanece o mesmo: 10 unidades saem do DEPOSITO e chegam na LOJA-CENTRO.</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2 items-start">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>O sistema verifica o saldo disponível na origem antes de confirmar. Se o saldo for insuficiente, a transferência é bloqueada com uma mensagem de erro.</span>
        </div>
      </section>

      {/* Posição Atual */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75" />
            </svg>
          </span>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Posição Atual</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          A tela de <strong>Posição Atual</strong> exibe o saldo atual de cada produto por local, calculado em tempo real com base em todas as movimentações e transferências registradas.
          Você pode filtrar por produto ou local.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
            <span className="text-slate-600 dark:text-slate-400 text-xs">Saldo positivo: produto disponível naquele local</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">!</span>
            <span className="text-slate-600 dark:text-slate-400 text-xs">Saldo zero ou negativo: destacado em vermelho, requer atenção</span>
          </div>
        </div>
      </section>

      {/* Fluxo recomendado */}
      <section className="bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold text-brand-800 dark:text-brand-200">Fluxo de uso recomendado</h2>
        <ol className="space-y-3">
          {[
            ['Cadastrar locais', 'Acesse "Locais" e cadastre os pontos de armazenamento da sua empresa (opcional — você pode usar só o GERAL).'],
            ['Registrar entrada inicial', 'Em "Movimentações", registre uma Entrada com a quantidade inicial de cada produto no local correspondente.'],
            ['Acompanhar na Posição Atual', 'Acesse "Posição Atual" para ver o saldo de todos os produtos. Aplique filtros por local se necessário.'],
            ['Registrar saídas do dia a dia', 'A cada venda ou consumo, registre uma Saída no local de onde o produto saiu.'],
            ['Transferir entre locais', 'Quando precisar reabastecê um ponto de venda a partir do depósito, use "Transferências".'],
            ['Ajustar após inventário', 'Após contagem física, registre um Ajuste para corrigir divergências no sistema.'],
          ].map(([titulo, desc], i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">{titulo}</p>
                <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default EstoqueInstrucoes;
