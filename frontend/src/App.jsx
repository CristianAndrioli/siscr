import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authService } from './services/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import CadastroGeral from './pages/cadastros/CadastroGeral';
import PessoasList from './pages/cadastros/PessoasList';
import PessoasDetail from './pages/cadastros/PessoasDetail';
import ProdutosList from './pages/cadastros/ProdutosList';
import ProdutosDetail from './pages/cadastros/ProdutosDetail';
import ServicosList from './pages/cadastros/ServicosList';
import ServicosDetail from './pages/cadastros/ServicosDetail';

// Componente para proteger rotas que precisam de autenticação
function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
  }, []);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
