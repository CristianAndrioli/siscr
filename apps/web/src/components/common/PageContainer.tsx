import { ReactNode } from 'react';

type PageContainerVariant = 'list' | 'form' | 'detail' | 'wide';

const VARIANT_MAX: Record<PageContainerVariant, string> = {
  list: 'max-w-6xl',
  wide: 'max-w-6xl',
  detail: 'max-w-4xl',
  form: 'max-w-3xl',
};

type Props = {
  variant?: PageContainerVariant;
  className?: string;
  children: ReactNode;
};

/**
 * Container centralizado do conteúdo da página (listas / formulários / detalhes).
 * O `<main>` do Layout já é branco; este wrapper só limita largura e centra.
 */
export default function PageContainer({
  variant = 'list',
  className = '',
  children,
}: Props) {
  return (
    <div className={`w-full ${VARIANT_MAX[variant]} mx-auto animate-fade-up ${className}`.trim()}>
      {children}
    </div>
  );
}
