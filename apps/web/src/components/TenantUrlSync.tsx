import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getTenantSlugFromHostname } from '../lib/tenantUrl';

/**
 * - Hostname `{slug}.base` (quando VITE_TENANT_HOST_BASE existe): grava slug no localStorage.
 * - Query `?tenant=slug` após login/cadastro: alinha localStorage e remove o parâmetro da URL.
 */
export default function TenantUrlSync() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fromHost = getTenantSlugFromHostname();
    if (fromHost) {
      localStorage.setItem('tenant_slug', fromHost);
    }
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const t = sp.get('tenant')?.trim().toLowerCase();
    if (!t) return;

    localStorage.setItem('tenant_slug', t);
    sp.delete('tenant');
    const qs = sp.toString();
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : '', hash: location.hash },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
