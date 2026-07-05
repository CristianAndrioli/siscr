import { useEffect, useRef } from 'react';

interface CodeEditorProps {
  language: 'html' | 'css' | 'javascript' | 'json';
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

/**
 * Editor de código simples usando textarea
 * TODO: Substituir por Monaco Editor quando disponível
 */
export default function CodeEditor({
  language,
  value,
  onChange,
  height = '200px',
  readOnly = false,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="w-full font-mono text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none transition-colors"
        style={{ minHeight: height }}
        placeholder={`Digite o código ${language.toUpperCase()} aqui...`}
        spellCheck={false}
      />
      <div className="absolute top-2 right-2">
        <span className="text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
          {language.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
