import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState({
    cadastros: false,
    financeiro: false,
    faturamento: false,
  });
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const toggleMenu = (menu) => {
    setMenuOpen((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex min-h-screen bg-gray-300">
      {/* Sidebar - Replica o design do base.html */}
      <aside className="w-64 bg-gray-800 text-white shadow-xl flex flex-col rounded-r-2xl">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-center">SISCR</h2>
        </div>
        
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-2">
            {/* Dashboard */}
            <li>
              <Link
                to="/dashboard"
                className={`flex items-center p-2 rounded-lg transition duration-150 ${
                  isActive('/dashboard') ? 'bg-gray-700' : 'hover:bg-gray-700'
                }`}
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-10l-2-2m2 2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </Link>
            </li>

            {/* Serviços Logísticos */}
            <li>
              <Link
                to="/servico-logistico"
                className={`flex items-center p-2 rounded-lg transition duration-150 ${
                  isActive('/servico-logistico') ? 'bg-gray-700' : 'hover:bg-gray-700'
                }`}
              >
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h.01M19 21H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
                </svg>
                Serviços Logísticos
              </Link>
            </li>

            {/* Cadastros - Menu com submenu */}
            <li>
              <button
                onClick={() => toggleMenu('cadastros')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Cadastros
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.cadastros ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.cadastros && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/cadastros/geral"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/cadastros/geral') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Geral (Pessoas/Empresas)
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cadastros/produtos"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/cadastros/produtos') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Produtos
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cadastros/servicos"
                      className={`block p-2 rounded-lg transition duration-150 text-sm ${
                        isActive('/cadastros/servicos') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      Serviços
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Financeiro - Menu com submenu */}
            <li>
              <button
                onClick={() => toggleMenu('financeiro')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 2v4m0 4v1m0-11c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-14v2m0 8v2" />
                  </svg>
                  Financeiro
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.financeiro ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.financeiro && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/financeiro/contas-a-receber"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      Contas a Receber
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/financeiro/contas-a-pagar"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      Contas a Pagar
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/financeiro"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      Visão Geral
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Faturamento - Menu com submenu */}
            <li>
              <button
                onClick={() => toggleMenu('faturamento')}
                className="flex items-center p-2 rounded-lg hover:bg-gray-700 transition duration-150 justify-between w-full"
              >
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Faturamento
                </span>
                <svg
                  className={`w-4 h-4 transform transition-transform duration-300 ${
                    menuOpen.faturamento ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen.faturamento && (
                <ul className="pl-6 mt-2 space-y-1">
                  <li>
                    <Link
                      to="/faturamento/cotacoes"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      Cotações/Análise Frete
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/faturamento/nf-venda"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      NF Venda
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/faturamento/nfse"
                      className="block p-2 rounded-lg hover:bg-gray-700 transition duration-150 text-sm"
                    >
                      NFSe
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* Perfil */}
            <li>
              <Link
                to="/perfil"
                className={`flex items-center p-2 rounded-lg transition duration-150 ${
                  isActive('/perfil') ? 'bg-gray-700' : 'hover:bg-gray-700'
                }`}
              >
                Meu Perfil
              </Link>
            </li>
          </ul>
        </nav>

        {/* Botão de Logout */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center p-2 rounded-lg bg-red-700 text-white hover:bg-red-600 transition duration-150 justify-center w-full"
          >
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}

export default Layout;
