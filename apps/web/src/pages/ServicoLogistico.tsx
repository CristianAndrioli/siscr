import { Link } from 'react-router-dom';

/**
 * Página de Serviços Logísticos
 * Centraliza o acesso a todos os serviços logísticos disponíveis
 */
function ServicoLogistico() {
  const servicos = [
    {
      id: 'lista-descricao-ncm',
      titulo: 'Lista de Descrição NCM',
      descricao: 'Consulte e gerencie códigos NCM (Nomenclatura Comum do Mercosul)',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      cor: 'bg-blue-500',
      href: '/servico-logistico/lista-descricao-ncm',
    },
    {
      id: 'solicitacao-estimativa-custos',
      titulo: 'Solicitação de Estimativa de Custos',
      descricao: 'Solicite e acompanhe estimativas de custos para operações logísticas',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      cor: 'bg-green-500',
      href: '/servico-logistico/solicitacao-estimativa-custos',
    },
    {
      id: 'abertura-mex',
      titulo: 'Abertura de MEX',
      descricao: 'Gerencie a abertura de Manifesto de Exportação',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      cor: 'bg-purple-500',
      href: '/servico-logistico/abertura-mex',
    },
    {
      id: 'follow-up',
      titulo: 'Follow Up',
      descricao: 'Acompanhe o status e andamento de operações logísticas',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      cor: 'bg-yellow-500',
      href: '/servico-logistico/follow-up',
    },
    {
      id: 'assessoria-importacao-exportacao',
      titulo: 'Assessoria Importação/Exportação',
      descricao: 'Acesse serviços de assessoria para importação e exportação',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      cor: 'bg-indigo-500',
      href: '/servico-logistico/assessoria-importacao-exportacao',
    },
    {
      id: 'documentacao',
      titulo: 'Documentação',
      descricao: 'Gerencie documentos necessários para operações logísticas',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      cor: 'bg-red-500',
      href: '/servico-logistico/documentacao',
    },
    {
      id: 'despacho-aduaneiro',
      titulo: 'Despacho Aduaneiro',
      descricao: 'Gerencie processos de despacho aduaneiro',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      cor: 'bg-teal-500',
      href: '/servico-logistico/despacho-aduaneiro',
    },
    {
      id: 'assessoria-cambial',
      titulo: 'Assessoria Cambial',
      descricao: 'Acesse serviços de assessoria cambial',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      cor: 'bg-orange-500',
      href: '/servico-logistico/assessoria-cambial',
    },
    {
      id: 'habilitacoes-certificacoes',
      titulo: 'Habilitações e Certificações',
      descricao: 'Gerencie habilitações e certificações necessárias',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      cor: 'bg-pink-500',
      href: '/servico-logistico/habilitacoes-certificacoes',
    },
    {
      id: 'desenvolvimento-fornecedores',
      titulo: 'Desenvolvimento de Fornecedores',
      descricao: 'Gerencie o desenvolvimento e relacionamento com fornecedores',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      cor: 'bg-cyan-500',
      href: '/servico-logistico/desenvolvimento-fornecedores',
    },
    {
      id: 'contrato',
      titulo: 'Contratos',
      descricao: 'Gerencie contratos de serviços logísticos',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      cor: 'bg-indigo-600',
      href: '/servico-logistico/contrato',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Serviços Logísticos</h1>
        <p className="mt-2 text-sm text-gray-500">
          Acesse e gerencie todos os serviços logísticos disponíveis
        </p>
      </div>

      {/* Grid de Serviços */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servicos.map((servico) => (
          <Link
            key={servico.id}
            to={servico.href}
            className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 p-6 border border-gray-200"
          >
            <div className="flex items-start space-x-4">
              <div className={`${servico.cor} text-white p-3 rounded-lg flex-shrink-0`}>
                {servico.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {servico.titulo}
                </h3>
                <p className="text-sm text-gray-600">
                  {servico.descricao}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Informação adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Sobre os Serviços Logísticos
            </h3>
            <p className="text-sm text-blue-800">
              Nossa plataforma oferece uma gama completa de serviços logísticos para facilitar suas operações de importação e exportação. 
              Cada serviço foi desenvolvido para atender necessidades específicas do seu negócio, desde documentação até assessoria especializada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServicoLogistico;

