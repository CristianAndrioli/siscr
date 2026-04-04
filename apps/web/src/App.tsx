import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, ReactNode } from 'react';
import { authService } from './services/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CotacoesPage from './pages/faturamento/Cotacoes';
import NFVendaPage from './pages/faturamento/NFVenda';
import NFSePage from './pages/faturamento/NFSe';
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
import FinanceiroDashboard from './pages/financeiro/FinanceiroDashboard';
import Configuracoes from './pages/Configuracoes';
import UsuariosList from './pages/usuarios/UsuariosList';
import UsuariosForm from './pages/usuarios/UsuariosForm';
import RolesList from './pages/configuracoes/RolesList';
import RolesForm from './pages/configuracoes/RolesForm';
import FiliaisList from './pages/configuracoes/FiliaisList';
import FiliaisForm from './pages/configuracoes/FiliaisForm';
import EmailSettingsPage from './pages/configuracoes/EmailSettings';
import Relatorios from './pages/configuracoes/Relatorios';
import EstoqueAtualList from './pages/estoque/EstoqueAtualList';
import MovimentacoesList from './pages/estoque/MovimentacoesList';
import Transferencias from './pages/estoque/Transferencias';
import LocaisPage from './pages/estoque/LocaisPage';
import EstoqueInstrucoes from './pages/estoque/EstoqueInstrucoes';

// Componente para proteger rotas que precisam de autenticação
interface ProtectedRouteProps {
  children: ReactNode;
  /** Quando true, ignora verificação de status do tenant (ex: /subscription-expired) */
  skipStatusCheck?: boolean;
}

function ProtectedRoute({ children, skipStatusCheck = false }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Verificar status do tenant — redirecionar se suspenso/cancelado
  if (!skipStatusCheck) {
    const tenantStatus = authService.getTenantStatus();
    if (tenantStatus && tenantStatus !== 'active') {
      return <Navigate to="/subscription-expired" replace />;
    }
  }

  return <>{children}</>;
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
            <ProtectedRoute skipStatusCheck>
              <PaymentPending />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription-expired"
          element={
            <ProtectedRoute skipStatusCheck>
              <SubscriptionExpired />
            </ProtectedRoute>
          }
        />
        {/* Dashboard financeiro */}
        <Route
          path="/financeiro/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="financeiro" requiredAction="view">
                  <FinanceiroDashboard />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/cotacoes"
          element={
            <ProtectedRoute>
              <Layout>
                <CotacoesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/nf-venda"
          element={
            <ProtectedRoute>
              <Layout>
                <NFVendaPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faturamento/nfse"
          element={
            <ProtectedRoute>
              <Layout>
                <NFSePage />
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
          path="/estoque/posicao"
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
          path="/estoque/transferencias"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <Transferencias />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/locais"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <LocaisPage />
                </ProtectedRouteWithPermission>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/estoque/instrucoes"
          element={
            <ProtectedRoute>
              <Layout>
                <ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view">
                  <EstoqueInstrucoes />
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

