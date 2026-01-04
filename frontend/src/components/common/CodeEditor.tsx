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
        className="w-full font-mono text-sm border border-gray-300 rounded-md p-3 focus:border-indigo-500 focus:ring-indigo-500 resize-none"
        style={{ minHeight: height }}
        placeholder={`Digite o código ${language.toUpperCase()} aqui...`}
        spellCheck={false}
      />
      <div className="absolute top-2 right-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          {language.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

