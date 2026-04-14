import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getTenantSlugFromHostname } from '../lib/tenantUrl';

/**
 * - Hostname `{slug}.base` (quando VITE_TENANT_HOST_BASE existe): grava slug no localStorage.
 * - Query `?tenant=slug`: alinha o localStorage (o parâmetro permanece na URL para você ver/compartilhar o link).
 */
export default function TenantUrlSync() {
  const location = useLocation();

  useEffect(() => {
    const fromHost = getTenantSlugFromHostname();
    if (fromHost) {
      localStorage.setItem('tenant_slug', fromHost);
    }
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tenant')?.trim().toLowerCase();
    if (!t) return;
    localStorage.setItem('tenant_slug', t);
  }, [location.pathname, location.search]);

  return null;
}
