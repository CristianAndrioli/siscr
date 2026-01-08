import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import SubscriptionManagement from './pages/SubscriptionManagement';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';
import AppHome from './pages/AppHome';
import Plans from './pages/Plans';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
import PaymentPending from './pages/PaymentPending';
import SubscriptionExpired from './pages/SubscriptionExpired';
import Layout from './components/Layout';
import ProtectedRouteWithPermission from './components/common/ProtectedRouteWithPermission';
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
import Configuracoes from './pages/Configuracoes';
import UsuariosList from './pages/usuarios/UsuariosList';
import UsuariosForm from './pages/usuarios/UsuariosForm';
import RolesList from './pages/configuracoes/RolesList';
import RolesForm from './pages/configuracoes/RolesForm';
import FiliaisList from './pages/configuracoes/FiliaisList';
import FiliaisForm from './pages/configuracoes/FiliaisForm';
import EmailSettingsPage from './pages/configuracoes/EmailSettings';
import Relatorios from './pages/configuracoes/Relatorios';
import LocationsList from './pages/estoque/LocationsList';
import LocationsDetail from './pages/estoque/LocationsDetail';
import EstoqueAtualList from './pages/estoque/EstoqueAtualList';
import EstoqueAtualDetail from './pages/estoque/EstoqueAtualDetail';
import MovimentacoesList from './pages/estoque/MovimentacoesList';
import MovimentacaoDetail from './pages/estoque/MovimentacaoDetail';
import Transferencias from './pages/estoque/Transferencias';
import TransferenciaDetail from './pages/estoque/TransferenciaDetail';
import ConfiguracoesEstoque from './pages/estoque/Configuracoes';
import RelatorioEstoque from './pages/estoque/Relatorio';

// Componente para proteger rotas que precisam de autenticação
interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);

      // Rotas que não precisam verificar subscription/tenant
      const exemptRoutes = [
        '/payment-pending',
        '/subscription-expired',
        '/profile',
        '/perfil'
      ];
      const isExemptRoute = exemptRoutes.includes(location.pathname) || 
                           location.pathname.startsWith('/checkout');
      
      // Se estiver autenticado e não estiver nas rotas especiais, verificar tenant e subscription
      if (authenticated && !isExemptRoute) {
        
        // Verificar se o tenant está ativo
        const tenantStr = localStorage.getItem('tenant');
        if (tenantStr) {
          try {
            const tenant = JSON.parse(tenantStr);
            if (tenant.is_active === false) {
              // Tenant desativado, redirecionar para tela de assinatura expirada
              window.location.href = '/subscription-expired';
              return;
            }
          } catch (e) {
            // Ignorar erro de parsing
          }
        }

        // Verificar subscription
        try {
          const { paymentsService } = await import('./services/payments');
          const subscription = await paymentsService.getCurrentSubscription();
          
          // Se subscription está pending ou past_due, redirecionar para payment-pending
          if (subscription.status === 'pending' || subscription.status === 'past_due') {
            window.location.href = '/payment-pending';
            return;
          }
          
          // Se subscription está canceled ou expired, redirecionar para subscription-expired
          if (subscription.status === 'canceled' || subscription.status === 'expired') {
            window.location.href = '/subscription-expired';
            return;
          }
        } catch (err: any) {
          // Se der erro 404, não há subscription (permitir acesso)
          // Se der erro 402, está pending (redirecionar)
          if (err.response?.status === 402) {
            window.location.href = '/payment-pending';
            return;
          }
          // Outros erros: permitir acesso (pode ser problema de conexão)
        }
      }
      
      setCheckingSubscription(false);
    };

    checkAuth();
  }, [location.pathname]);

  if (isAuthenticated === null || checkingSubscription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// Componente para rota raiz - redireciona baseado em autenticação
function RootRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const authenticated = authService.isAuthenticated();
    setIsAuthenticated(authenticated);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/app" replace /> : <Home />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppHome />
            </ProtectedRoute>
          }
        />
        <Route path="/plans" element={<Plans />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        <Route
          path="/payment-pending"
          element={
            <ProtectedRoute>
              <PaymentPending />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription-expired"
          element={
            <ProtectedRoute>
              <SubscriptionExpired />
            </ProtectedRoute>
          }
        />
        {/* Dashboard movido para dentro do módulo financeiro */}
        <Route
          path="/financeiro/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="financeiro" requiredAction="view">
                  <Dashboard />
                </ProtectedRouteWithPermission>
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
          path="/subscription-management"
          element={
            <ProtectedRoute>
              <Layout>
                <SubscriptionManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Perfil />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Alias para compatibilidade */}
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
        {/* Rotas de gerenciamento de usuários */}
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <Layout>
                <UsuariosList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios/novo"
          element={
            <ProtectedRoute>
              <Layout>
                <UsuariosForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <UsuariosForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Rotas de gerenciamento de roles */}
        <Route
          path="/configuracoes/roles"
          element={
            <ProtectedRoute>
              <Layout>
                <RolesList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/roles/novo"
          element={
            <ProtectedRoute>
              <Layout>
                <RolesForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/roles/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <RolesForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Rotas de gerenciamento de filiais */}
        <Route
          path="/configuracoes/filiais"
          element={
            <ProtectedRoute>
              <Layout>
                <FiliaisList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/filiais/novo"
          element={
            <ProtectedRoute>
              <Layout>
                <FiliaisForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/filiais/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <FiliaisForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Rota de configurações de email */}
        <Route
          path="/configuracoes/email"
          element={
            <ProtectedRoute>
              <Layout>
                <EmailSettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Rota de configurações de relatórios */}
        <Route
          path="/configuracoes/relatorios"
          element={
            <ProtectedRoute>
              <Layout>
                <Relatorios />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Rota genérica de configurações (deve vir depois das rotas específicas) */}
        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute>
              <Layout>
                <Configuracoes />
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
        {/* Rotas de Estoque */}
        <Route
          path="/estoque/locations"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <LocationsList />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/locations/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <LocationsDetail />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/estoque-atual"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <EstoqueAtualList />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/estoque-atual/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <EstoqueAtualDetail />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/movimentacoes"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <MovimentacoesList />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/movimentacoes/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <MovimentacaoDetail />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/transferencias"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="transfer">
                  <Transferencias />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/transferencias/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="transfer">
                  <TransferenciaDetail />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/configuracoes"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="change">
                  <ConfiguracoesEstoque />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/relatorio"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <RelatorioEstoque />
                </ProtectedRouteWithPermission>
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

