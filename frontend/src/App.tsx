import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, ReactNode } from 'react';
import { authService } from './services/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ServicoLogistico from './pages/ServicoLogistico';
import Perfil from './pages/Perfil';
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
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
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

