import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, ReactNode } from 'react';
import { authService } from './services/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServicoLogistico from './pages/ServicoLogistico';
import ListaDescricaoNCM from './pages/servico-logistico/ListaDescricaoNCM';
import SolicitacaoEstimativaCustos from './pages/servico-logistico/SolicitacaoEstimativaCustos';
import AberturaMEX from './pages/servico-logistico/AberturaMEX';
import FollowUp from './pages/servico-logistico/FollowUp';
import AssessoriaImportacaoExportacao from './pages/servico-logistico/AssessoriaImportacaoExportacao';
import Documentacao from './pages/servico-logistico/Documentacao';
import DespachoAduaneiro from './pages/servico-logistico/DespachoAduaneiro';
import AssessoriaCambial from './pages/servico-logistico/AssessoriaCambial';
import HabilitacoesCertificacoes from './pages/servico-logistico/HabilitacoesCertificacoes';
import DesenvolvimentoFornecedores from './pages/servico-logistico/DesenvolvimentoFornecedores';
import Cotacoes from './pages/faturamento/Cotacoes';
import CotacaoCambio from './pages/faturamento/CotacaoCambio';
import NFVenda from './pages/faturamento/NFVenda';
import NFSe from './pages/faturamento/NFSe';
import Monitoramento from './pages/Monitoramento';
import Contrato from './pages/servico-logistico/Contrato';
import ListaDescricaoProdutosRegistroDI from './pages/servico-logistico/ListaDescricaoProdutosRegistroDI';
import ControleProcesso from './pages/servico-logistico/ControleProcesso';
import CheckListProcessosAPACOMEX from './pages/servico-logistico/CheckListProcessosAPACOMEX';
import CheckListProcessos from './pages/servico-logistico/CheckListProcessos';
import CotacaoFreteInternacionalRodoviario from './pages/servico-logistico/CotacaoFreteInternacionalRodoviario';
import AnaliseFechamentoFrete from './pages/servico-logistico/AnaliseFechamentoFrete';
import Perfil from './pages/Perfil';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import Plans from './pages/Plans';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import Layout from './components/Layout';
import CadastroGeral from './pages/cadastros/CadastroGeral';
import PessoasList from './pages/cadastros/PessoasList';
import PessoasDetail from './pages/cadastros/PessoasDetail';
import ProdutosList from './pages/cadastros/ProdutosList';
import ProdutosDetail from './pages/cadastros/ProdutosDetail';
import ServicosList from './pages/cadastros/ServicosList';
import ServicosDetail from './pages/cadastros/ServicosDetail';
import ContasReceberList from './pages/financeiro/ContasReceberList';
import ContasReceberDetail from './pages/financeiro/ContasReceberDetail';
import ContasPagarList from './pages/financeiro/ContasPagarList';
import ContasPagarDetail from './pages/financeiro/ContasPagarDetail';

// Componente para proteger rotas que precisam de autenticação
interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico"
          element={
            <ProtectedRoute>
              <Layout>
                <ServicoLogistico />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/lista-descricao-ncm"
          element={
            <ProtectedRoute>
              <Layout>
                <ListaDescricaoNCM />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/solicitacao-estimativa-custos"
          element={
            <ProtectedRoute>
              <Layout>
                <SolicitacaoEstimativaCustos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/abertura-mex"
          element={
            <ProtectedRoute>
              <Layout>
                <AberturaMEX />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/follow-up"
          element={
            <ProtectedRoute>
              <Layout>
                <FollowUp />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/assessoria-importacao-exportacao"
          element={
            <ProtectedRoute>
              <Layout>
                <AssessoriaImportacaoExportacao />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/documentacao"
          element={
            <ProtectedRoute>
              <Layout>
                <Documentacao />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/despacho-aduaneiro"
          element={
            <ProtectedRoute>
              <Layout>
                <DespachoAduaneiro />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/assessoria-cambial"
          element={
            <ProtectedRoute>
              <Layout>
                <AssessoriaCambial />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/habilitacoes-certificacoes"
          element={
            <ProtectedRoute>
              <Layout>
                <HabilitacoesCertificacoes />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/desenvolvimento-fornecedores"
          element={
            <ProtectedRoute>
              <Layout>
                <DesenvolvimentoFornecedores />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/cotacoes"
          element={
            <ProtectedRoute>
              <Layout>
                <Cotacoes />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/nf-venda"
          element={
            <ProtectedRoute>
              <Layout>
                <NFVenda />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/nfse"
          element={
            <ProtectedRoute>
              <Layout>
                <NFSe />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/cotacao-cambio"
          element={
            <ProtectedRoute>
              <Layout>
                <CotacaoCambio />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/contrato"
          element={
            <ProtectedRoute>
              <Layout>
                <Contrato />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/lista-descricao-produtos-registro-di"
          element={
            <ProtectedRoute>
              <Layout>
                <ListaDescricaoProdutosRegistroDI />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/controle-processo"
          element={
            <ProtectedRoute>
              <Layout>
                <ControleProcesso />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/checklist-processos-apacomex"
          element={
            <ProtectedRoute>
              <Layout>
                <CheckListProcessosAPACOMEX />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/checklist-processos"
          element={
            <ProtectedRoute>
              <Layout>
                <CheckListProcessos />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/cotacao-frete-internacional-rodoviario"
          element={
            <ProtectedRoute>
              <Layout>
                <CotacaoFreteInternacionalRodoviario />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servico-logistico/analise-fechamento-frete"
          element={
            <ProtectedRoute>
              <Layout>
                <AnaliseFechamentoFrete />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoramento"
          element={
            <ProtectedRoute>
              <Layout>
                <Monitoramento />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <Layout>
                <Perfil />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/geral"
          element={
            <ProtectedRoute>
              <Layout>
                <CadastroGeral />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/geral/:codigo"
          element={
            <ProtectedRoute>
              <Layout>
                <CadastroGeral />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Novas rotas usando estrutura base */}
        <Route
          path="/cadastros/pessoas"
          element={
            <ProtectedRoute>
              <Layout>
                <PessoasList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/pessoas/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PessoasDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/produtos"
          element={
            <ProtectedRoute>
              <Layout>
                <ProdutosList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/produtos/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProdutosDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/servicos"
          element={
            <ProtectedRoute>
              <Layout>
                <ServicosList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastros/servicos/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ServicosDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Rotas de Financeiro */}
        <Route
          path="/financeiro/contas-receber"
          element={
            <ProtectedRoute>
              <Layout>
                <ContasReceberList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro/contas-receber/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ContasReceberDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro/contas-pagar"
          element={
            <ProtectedRoute>
              <Layout>
                <ContasPagarList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro/contas-pagar/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ContasPagarDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

