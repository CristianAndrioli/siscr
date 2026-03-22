import { useState, useEffect, useRef } from 'react';
import { Button, LoadingSpinner } from '../common';
import { generatorService } from '../../services/reports/generator';

interface ReportPreviewProps {
  tipo: string;
  modulo?: string;
  templateId?: number | null;
  templateHtml?: string;
  templateCss?: string;
  onClose?: () => void;
}

/**
 * Componente para preview de relatórios
 */
export default function ReportPreview({
  tipo,
  modulo,
  templateId,
  templateHtml,
  templateCss,
  onClose,
}: ReportPreviewProps) {
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Preview local quando template_html é fornecido
  useEffect(() => {
    if (templateHtml) {
      // Preview local com HTML/CSS customizado - atualiza em tempo real
      const combinedHtml = combineHtmlCss(templateHtml, templateCss || '');
      setPreviewHtml(combinedHtml);
    } else if (tipo) {
      // Carregar preview da API quando não há template_html customizado
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateHtml, templateCss, tipo, modulo, templateId]);

  const loadPreview = async () => {
    setLoading(true);
    setError('');

    try {
      // Usar API de preview
      const response = await generatorService.preview({
        tipo,
        modulo,
        template_id: templateId || null,
      });
      setPreviewHtml(response.html);
    } catch (err: any) {
      console.error('Erro ao carregar preview:', err);
      setError('Erro ao carregar preview do relatório');
    } finally {
      setLoading(false);
    }
  };

  const combineHtmlCss = (html: string, css: string): string => {
    // Se o HTML já tem <style>, adicionar CSS dentro
    // Se não, criar um <style> tag
    if (html.includes('</head>') || html.includes('</style>')) {
      // HTML completo, adicionar CSS no head ou style existente
      if (css && html.includes('</head>')) {
        return html.replace('</head>', `<style>${css}</style></head>`);
      } else if (css && html.includes('</style>')) {
        return html.replace('</style>', `${css}</style>`);
      }
      return html;
    } else {
      // HTML simples, criar estrutura básica
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            ${css}
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;
    }
  };

  const updateIframeContent = () => {
    if (iframeRef.current && previewHtml) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  };

  useEffect(() => {
    updateIframeContent();
  }, [previewHtml]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Preview do Relatório</h3>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadPreview} disabled={loading}>
            Atualizar
          </Button>
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {!loading && !error && previewHtml && (
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Preview do Relatório"
            className="w-full"
            style={{ height: '600px', border: 'none' }}
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      )}

      {!loading && !error && !previewHtml && (
        <div className="text-center text-gray-500 py-8">
          Nenhum preview disponível. Configure o template primeiro.
        </div>
      )}
    </div>
  );
}

