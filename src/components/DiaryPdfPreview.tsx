import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Worker do PDF.js (Vite resolve para uma URL de asset)
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface DiaryPdfPreviewProps {
  /** URL (blob) do PDF a renderizar. */
  url: string;
}

/**
 * Renderiza o PDF em <canvas> ajustado à largura do container — totalmente
 * responsivo, sem o visualizador nativo do navegador (que não escala em mobile).
 * Faz a troca das páginas de forma atômica para não piscar.
 */
export const DiaryPdfPreview: React.FC<DiaryPdfPreviewProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);

  // Acompanha a largura disponível (ignora variações mínimas, ex.: barra do navegador mobile)
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.clientWidth);
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Renderiza as páginas sempre que a URL ou a largura mudarem
  useEffect(() => {
    if (!url || !width || !containerRef.current) return;
    let cancelled = false;
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    (async () => {
      try {
        task = pdfjsLib.getDocument(url);
        const pdf = await task.promise;
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Renderiza em um fragmento e só então substitui o conteúdo (evita flash)
        const fragment = document.createDocumentFragment();
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.className = 'block w-full mb-3 rounded shadow-sm bg-white';

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (cancelled) return;
          fragment.appendChild(canvas);
        }

        if (cancelled || !containerRef.current) return;
        containerRef.current.replaceChildren(fragment);
        setFirstLoad(false);
      } catch {
        /* ignora falhas de render; o botão Exportar PDF continua disponível */
      }
    })();

    return () => {
      cancelled = true;
      try {
        task?.destroy?.();
      } catch {
        /* noop */
      }
    };
  }, [url, width]);

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" />
      {firstLoad && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-16">
          Gerando pré-visualização...
        </div>
      )}
    </div>
  );
};
