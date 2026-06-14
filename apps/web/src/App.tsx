import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TenantUrlSync from './components/TenantUrlSync';
import { useState, useEffect, ReactNode } from 'react';
import { authService } from './services/auth';
import { ErrorNotificationProvider } from './context/ErrorNotificationContext';
import ErrorToastStack from './components/common/ErrorToast';
import ErrorLogsPage from './pages/configuracoes/ErrorLogsPage';
import Login from './pages/Login';
import CotacoesPage from './pages/faturamento/Cotacoes';
import NFVendaPage from './pages/faturamento/NFVenda';
import NfeNovaWizardPage from './pages/faturamento/NfeNovaWizard';
import NFSePage from './pages/faturamento/NFSe';
import { NcmConfigPage } from './pages/faturamento/NcmConfigPage';
import Perfil from './pages/Perfil';
import SubscriptionManagement from './pages/SubscriptionManagement';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import AppHome from './pages/AppHome';
import Plans from './pages/Plans';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import CheckoutSuccess from './pages/CheckoutSuccess';
import CheckoutCancel from './pages/CheckoutCancel';
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
import ReguaCobrancaList from './pages/financeiro/ReguaCobrancaList';
import ReguaCobrancaDetail from './pages/financeiro/ReguaCobrancaDetail';
import ContasBancariasPage from './pages/financeiro/ContasBancariasPage';
import Configuracoes from './pages/Configuracoes';
import { UsuariosPage } from './pages/configuracoes/UsuariosPage';
import { FiliaisPage } from './pages/configuracoes/FiliaisPage';
import { FaturamentoConfigPage } from './pages/configuracoes/FaturamentoConfigPage';
import { PermissoesPage } from './pages/configuracoes/PermissoesPage';
import PersonalizacaoPage from './pages/configuracoes/PersonalizacaoPage';
import EstoqueAtualList from './pages/estoque/EstoqueAtualList';
import MovimentacoesList from './pages/estoque/MovimentacoesList';
import Transferencias from './pages/estoque/Transferencias';
import LocaisPage from './pages/estoque/LocaisPage';
import EstoqueInstrucoes from './pages/estoque/EstoqueInstrucoes';
import MaquinasList from './pages/frota/MaquinasList';
import MaquinasDetail from './pages/frota/MaquinasDetail';
import ObrasList from './pages/frota/ObrasList';
import ObrasDetail from './pages/frota/ObrasDetail';
import OrdensServicoList from './pages/frota/OrdensServicoList';
import OrdensServicoDetail from './pages/frota/OrdensServicoDetail';
import NfEntradaList from './pages/entrada/NfEntradaList';
import NfEntradaDetail from './pages/entrada/NfEntradaDetail';
import NfEntradaWizardPage from './pages/entrada/NfEntradaWizard';

interface ProtectedRouteProps {
  children: ReactNode;
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

  if (!skipStatusCheck) {
    const tenantStatus = authService.getTenantStatus();
    if (tenantStatus && tenantStatus !== 'active') {
      return <Navigate to="/subscription-expired" replace />;
    }
  }

  return <>{children}</>;
}

function RootRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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

  return isAuthenticated ? <Navigate to="/app" replace /> : <Home />;
}

function App() {
  return (
    <Router>
      <TenantUrlSync />
      <ErrorNotificationProvider>
        <ErrorToastStack />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/app" element={<ProtectedRoute><AppHome /></ProtectedRoute>} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
        <Route path="/payment-pending" element={<Navigate to="/subscription-expired" replace />} />
        <Route path="/subscription-expired" element={<ProtectedRoute skipStatusCheck><SubscriptionExpired /></ProtectedRoute>} />

        {/* Financeiro */}
        <Route path="/financeiro/dashboard" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="financeiro" requiredAction="view"><FinanceiroDashboard /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/financeiro/regua-cobranca" element={<ProtectedRoute><Layout><ReguaCobrancaList /></Layout></ProtectedRoute>} />
        <Route path="/financeiro/regua-cobranca/:id" element={<ProtectedRoute><Layout><ReguaCobrancaDetail /></Layout></ProtectedRoute>} />
        <Route path="/financeiro/contas-receber" element={<ProtectedRoute><Layout><ContasReceberList /></Layout></ProtectedRoute>} />
        <Route path="/financeiro/contas-receber/:id" element={<ProtectedRoute><Layout><ContasReceberDetail /></Layout></ProtectedRoute>} />
        <Route path="/financeiro/contas-pagar" element={<ProtectedRoute><Layout><ContasPagarList /></Layout></ProtectedRoute>} />
        <Route path="/financeiro/contas-pagar/:id" element={<ProtectedRoute><Layout><ContasPagarDetail /></Layout></ProtectedRoute>} />
        <Route path="/financeiro/contas-bancarias" element={<ProtectedRoute><Layout><ContasBancariasPage /></Layout></ProtectedRoute>} />

        {/* Faturamento */}
        <Route path="/faturamento/cotacoes" element={<ProtectedRoute><Layout><CotacoesPage /></Layout></ProtectedRoute>} />
        <Route path="/faturamento/nf-venda" element={<ProtectedRoute><Layout><NFVendaPage /></Layout></ProtectedRoute>} />
        <Route path="/faturamento/nf-venda/nova" element={<ProtectedRoute><Layout><NfeNovaWizardPage /></Layout></ProtectedRoute>} />
        <Route path="/faturamento/ncm" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="faturamento" requiredAction="view"><NcmConfigPage /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/faturamento/nfse" element={<ProtectedRoute><Layout><NFSePage /></Layout></ProtectedRoute>} />

        {/* Entrada (NF-e compra) */}
        <Route path="/entrada/nf-e/nova" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="faturamento" requiredAction="change"><NfEntradaWizardPage /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/entrada/notas" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="faturamento" requiredAction="view"><NfEntradaList /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/entrada/notas/:id" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="faturamento" requiredAction="view"><NfEntradaDetail /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />

        {/* Subscription */}
        <Route path="/subscription-management" element={<ProtectedRoute><Layout><SubscriptionManagement /></Layout></ProtectedRoute>} />

        {/* Perfil */}
        <Route path="/profile" element={<ProtectedRoute><Layout><Perfil /></Layout></ProtectedRoute>} />
        <Route path="/perfil" element={<ProtectedRoute><Layout><Perfil /></Layout></ProtectedRoute>} />

        {/* Cadastros */}
        <Route path="/cadastros/geral" element={<ProtectedRoute><Layout><CadastroGeral /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/geral/:codigo" element={<ProtectedRoute><Layout><CadastroGeral /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/pessoas" element={<ProtectedRoute><Layout><PessoasList /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/pessoas/:id" element={<ProtectedRoute><Layout><PessoasDetail /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/produtos" element={<ProtectedRoute><Layout><ProdutosList /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/produtos/:id" element={<ProtectedRoute><Layout><ProdutosDetail /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/servicos" element={<ProtectedRoute><Layout><ServicosList /></Layout></ProtectedRoute>} />
        <Route path="/cadastros/servicos/:id" element={<ProtectedRoute><Layout><ServicosDetail /></Layout></ProtectedRoute>} />

        {/* Estoque */}
        <Route path="/estoque/posicao" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view"><EstoqueAtualList /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/estoque/movimentacoes" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view"><MovimentacoesList /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/estoque/transferencias" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view"><Transferencias /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/estoque/locais" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view"><LocaisPage /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/estoque/instrucoes" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="estoque" requiredAction="view"><EstoqueInstrucoes /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />

        {/* ─── Frota ──────────────────────────────────────────────────── */}
        <Route path="/frota/maquinas" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="frota" requiredAction="view"><MaquinasList /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/frota/maquinas/:id" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="frota" requiredAction="view"><MaquinasDetail /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/frota/obras" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="frota" requiredAction="view"><ObrasList /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/frota/obras/:id" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="frota" requiredAction="view"><ObrasDetail /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/frota/ordens-servico" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="frota" requiredAction="view"><OrdensServicoList /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />
        <Route path="/frota/ordens-servico/:id" element={<ProtectedRoute><Layout><ProtectedRouteWithPermission requiredModule="frota" requiredAction="view"><OrdensServicoDetail /></ProtectedRouteWithPermission></Layout></ProtectedRoute>} />

        {/* Configurações */}
        <Route path="/configuracoes/usuarios" element={<ProtectedRoute><Layout><UsuariosPage /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes/filiais" element={<ProtectedRoute><Layout><FiliaisPage /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes/faturamento" element={<ProtectedRoute><Layout><FaturamentoConfigPage /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes/permissoes" element={<ProtectedRoute><Layout><PermissoesPage /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes/personalizacao" element={<ProtectedRoute><PersonalizacaoPage /></ProtectedRoute>} />
        <Route path="/configuracoes/logs/:id" element={<ProtectedRoute><Layout><ErrorLogsPage /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes/logs" element={<ProtectedRoute><Layout><ErrorLogsPage /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Layout><Configuracoes /></Layout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorNotificationProvider>
    </Router>
  );
}

export default App;
