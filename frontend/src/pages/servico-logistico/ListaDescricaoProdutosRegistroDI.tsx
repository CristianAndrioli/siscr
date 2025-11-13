import PlaceholderService from './PlaceholderService';

function ListaDescricaoProdutosRegistroDI() {
  return (
    <PlaceholderService
      title="Lista de Descrição de Produtos para Registro DI"
      description="Gerencie listas de descrição de produtos para registro de Declaração de Importação"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
    />
  );
}

export default ListaDescricaoProdutosRegistroDI;

