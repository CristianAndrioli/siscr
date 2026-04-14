/**
 * Hostname opcional por tenant (produção com DNS wildcard), ex.: VITE_TENANT_HOST_BASE=app.suaempresa.com
 * → URLs https://{slug}.app.suaempresa.com
 *
 * Em staging (*.pages.dev) isso normalmente fica vazio: não há subdomínio por cliente no mesmo projeto.
 */
export function getTenantHostBase(): string | undefined {
  const v = import.meta.env.VITE_TENANT_HOST_BASE as string | undefined;
  const t = v?.trim();
  return t || undefined;
}

/** Extrai o slug do subdomínio quando o host é `{slug}.{base}` */
export function getTenantSlugFromHostname(): string | null {
  const base = getTenantHostBase();
  if (!base) return null;
  const host = window.location.hostname.toLowerCase();
  const b = base.toLowerCase();
  if (host === b) return null;
  if (!host.endsWith(`.${b}`)) return null;
  const sub = host.slice(0, -(b.length + 1));
  if (!sub || sub.includes('.')) return null;
  return sub;
}

/** Origem https://{slug}.base — só quando VITE_TENANT_HOST_BASE está definido */
export function buildTenantOrigin(slug: string): string | null {
  const base = getTenantHostBase();
  if (!base || !slug.trim()) return null;
  return `${window.location.protocol}//${slug.trim().toLowerCase()}.${base}`;
}
