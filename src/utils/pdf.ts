import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type ExportOptions = {
  title?: string;
  logoUrl?: string;
  headerBgColor?: string;
  marginMm?: number;
  showHeader?: boolean;
};

async function loadImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  const blob = await res.blob();
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function exportElementToPDF(
  element: HTMLElement,
  fileName: string,
  options: ExportOptions = {}
): Promise<void> {
  const {
    title = 'Diário de Obra',
    logoUrl = '/logogeoteste.png',
    headerBgColor = '#F0FDF4',
    marginMm = 3,
    showHeader = true,
  } = options;

  const MOBILE_WIDTH = 375;
  const originalStyles: { element: HTMLElement; styles: { cssText: string } }[] = [];

  const pdfContainer = (element.querySelector('[class*="max-w-"]') as HTMLElement) || element;
  const parentContainer = pdfContainer.parentElement;

  const applyMobileDimensions = () => {
    originalStyles.push({ element, styles: { cssText: element.style.cssText } });
    element.style.width = `${MOBILE_WIDTH}px`;
    element.style.maxWidth = `${MOBILE_WIDTH}px`;
    element.style.margin = '0 auto';

    if (pdfContainer && pdfContainer !== element) {
      originalStyles.push({ element: pdfContainer, styles: { cssText: pdfContainer.style.cssText } });
      pdfContainer.style.width = `${MOBILE_WIDTH}px`;
      pdfContainer.style.maxWidth = `${MOBILE_WIDTH}px`;
    }

    if (parentContainer) {
      originalStyles.push({ element: parentContainer, styles: { cssText: parentContainer.style.cssText } });
      parentContainer.style.width = `${MOBILE_WIDTH}px`;
      parentContainer.style.maxWidth = `${MOBILE_WIDTH}px`;
    }

    void element.offsetHeight;
  };

  const restoreOriginalDimensions = () => {
    originalStyles.forEach(({ element: target, styles }) => {
      target.style.cssText = styles.cssText;
    });
  };

  applyMobileDimensions();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  try {
    const allSections = Array.from(element.querySelectorAll('section, [data-pdf-section]')) as HTMLElement[];

    interface SectionInfo {
      topPx: number;
      heightPx: number;
      bottomPx: number;
      topCanvas: number;
      heightCanvas: number;
      bottomCanvas: number;
      element: HTMLElement;
    }

    const HIGH_RES_SCALE = 5.0;

    const getSectionInfo = (section: HTMLElement | null): SectionInfo | null => {
      if (!section) return null;
      const rect = section.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const topPx = rect.top - elementRect.top + element.scrollTop;
      const heightPx = rect.height;
      const bottomPx = topPx + heightPx;
      return {
        topPx,
        heightPx,
        bottomPx,
        topCanvas: topPx * HIGH_RES_SCALE,
        heightCanvas: heightPx * HIGH_RES_SCALE,
        bottomCanvas: bottomPx * HIGH_RES_SCALE,
        element: section,
      };
    };

    const allSectionsInfo = allSections
      .map((section) => getSectionInfo(section))
      .filter((info): info is SectionInfo => info !== null)
      .sort((a, b) => a.topCanvas - b.topCanvas);

    const assinaturasSection = element.querySelector('[data-pdf-section="assinaturas"]') as HTMLElement;
    const assinaturasInfo = getSectionInfo(assinaturasSection);

    const canvas = await html2canvas(element, {
      scale: HIGH_RES_SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      letterRendering: true,
      allowTaint: false,
      removeContainer: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.body.querySelector('div[class*="max-w-"]') || clonedDoc.body;
        if (clonedElement) {
          const htmlElement = clonedElement as HTMLElement;
          htmlElement.style.imageRendering = 'crisp-edges';
          htmlElement.style.textRendering = 'optimizeLegibility';
          htmlElement.style.webkitFontSmoothing = 'antialiased';
          htmlElement.style.mozOsxFontSmoothing = 'grayscale';

          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach((el) => {
            const item = el as HTMLElement;
            item.style.textRendering = 'optimizeLegibility';
            item.style.webkitFontSmoothing = 'antialiased';
            item.style.mozOsxFontSmoothing = 'grayscale';
          });
        }
      },
      ignoreElements: (el: Element) => {
        try {
          return (el as HTMLElement)?.getAttribute?.('data-pdf-hide') === 'true';
        } catch {
          return false;
        }
      },
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const headerHeight = showHeader ? 8 : 0;

    const usableWidth = pageWidth - marginMm * 2;
    const usablePageHeight = pageHeight - marginMm * 2 - headerHeight;
    const pxPerMm = canvas.width / usableWidth;
    const pageHeightPx = usablePageHeight * pxPerMm;

    type SliceDecision = {
      sliceHeightPx: number;
      nextStartPx?: number;
    };

    const computeSliceDecision = (startPx: number): SliceDecision => {
      const maxSliceHeight = Math.min(pageHeightPx, canvas.height - startPx);
      const pageTop = startPx;
      const pageBottom = startPx + maxSliceHeight;

      if (assinaturasInfo) {
        const assinaturasTop = assinaturasInfo.topCanvas;
        const assinaturasBottom = assinaturasInfo.bottomCanvas;
        const assinaturasHeight = assinaturasBottom - assinaturasTop;
        const documentEnd = canvas.height;
        const remainingFromSignatures = documentEnd - assinaturasTop;

        if (assinaturasTop < pageTop && assinaturasBottom > pageTop && assinaturasHeight <= pageHeightPx) {
          return { sliceHeightPx: maxSliceHeight, nextStartPx: assinaturasTop };
        }

        if (assinaturasTop >= pageTop && assinaturasTop < pageBottom) {
          const availableSpace = pageBottom - assinaturasTop;
          const spaceBefore = assinaturasTop - startPx;

          if (remainingFromSignatures > availableSpace) {
            if (spaceBefore > 0) {
              return { sliceHeightPx: spaceBefore };
            }
          } else {
            return { sliceHeightPx: Math.min(documentEnd - startPx, canvas.height - startPx) };
          }
        }
      }

      for (const sectionInfo of allSectionsInfo) {
        if (sectionInfo === assinaturasInfo) continue;

        const sectionTop = sectionInfo.topCanvas;
        const sectionBottom = sectionInfo.bottomCanvas;
        const sectionHeight = sectionBottom - sectionTop;

        if (sectionTop < pageTop && sectionBottom > pageTop && sectionHeight <= pageHeightPx) {
          return { sliceHeightPx: maxSliceHeight, nextStartPx: sectionTop };
        }
      }

      for (const sectionInfo of allSectionsInfo) {
        if (sectionInfo === assinaturasInfo) continue;

        const sectionTop = sectionInfo.topCanvas;
        const sectionBottom = sectionInfo.bottomCanvas;
        const sectionHeight = sectionBottom - sectionTop;

        if (sectionTop === startPx) {
          if (sectionHeight <= pageHeightPx) {
            return { sliceHeightPx: Math.min(sectionHeight, canvas.height - startPx) };
          }
          return { sliceHeightPx: Math.min(pageHeightPx, canvas.height - startPx) };
        }

        if (sectionTop > startPx && sectionTop < pageBottom) {
          const availableSpace = pageBottom - sectionTop;
          const spaceBefore = sectionTop - startPx;

          if (sectionHeight <= pageHeightPx && sectionHeight > availableSpace) {
            return { sliceHeightPx: spaceBefore };
          }
        }
      }

      return { sliceHeightPx: maxSliceHeight };
    };

    const slices: Array<{ topPx: number; heightPx: number }> = [];
    let cursorPx = 0;
    let safetyCounter = 0;

    while (cursorPx < canvas.height) {
      safetyCounter += 1;
      if (safetyCounter > 10000) {
        throw new Error('Erro ao calcular paginação do PDF. Tente novamente.');
      }

      const decision = computeSliceDecision(cursorPx);

      if (typeof decision.nextStartPx === 'number') {
        if (decision.nextStartPx <= cursorPx) {
          const fallbackHeight = Math.max(1, Math.min(pageHeightPx, canvas.height - cursorPx));
          slices.push({ topPx: cursorPx, heightPx: fallbackHeight });
          cursorPx += fallbackHeight;
        } else {
          cursorPx = decision.nextStartPx;
        }
        continue;
      }

      const safeSliceHeight = Math.max(1, Math.min(decision.sliceHeightPx, canvas.height - cursorPx));
      slices.push({ topPx: cursorPx, heightPx: safeSliceHeight });
      cursorPx += safeSliceHeight;
    }

    const totalPages = Math.max(1, slices.length);
    const logoDataUrl = showHeader && logoUrl ? await loadImageAsDataUrl(logoUrl) : undefined;

    const drawHeader = (pageNumber: number) => {
      pdf.setFillColor(headerBgColor);
      pdf.rect(0, 0, pageWidth, headerHeight + marginMm, 'F');

      if (logoDataUrl) {
        const logoHeight = 5;
        const logoWidth = 5;
        const isPng = logoDataUrl.startsWith('data:image/png');
        pdf.addImage(
          logoDataUrl,
          isPng ? 'PNG' : 'JPEG',
          marginMm,
          marginMm,
          logoWidth,
          logoHeight,
          undefined,
          'SLOW'
        );
      }

      pdf.setTextColor(22, 22, 22);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(title, pageWidth / 2, marginMm + 2.5, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6);
      pdf.setTextColor(100);
      pdf.text(`${pageNumber}/${totalPages}`, pageWidth - marginMm, marginMm + 2.5, { align: 'right' });
    };

    slices.forEach((slice, index) => {
      if (index > 0) {
        pdf.addPage('a4');
      }

      if (showHeader) {
        drawHeader(index + 1);
      }

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = slice.heightPx;

      const pageContext = pageCanvas.getContext('2d', {
        alpha: false,
        desynchronized: false,
        willReadFrequently: false,
        colorSpace: 'srgb',
      });

      if (!pageContext) {
        throw new Error('Erro ao gerar o PDF. Tente novamente.');
      }

      pageContext.imageSmoothingEnabled = true;
      pageContext.imageSmoothingQuality = 'high';

      pageContext.drawImage(
        canvas,
        0,
        slice.topPx,
        canvas.width,
        slice.heightPx,
        0,
        0,
        canvas.width,
        slice.heightPx
      );

      const pageImgData = pageCanvas.toDataURL('image/png');
      const pageHeightMm = slice.heightPx / pxPerMm;
      const offsetX = marginMm;
      const offsetY = showHeader ? marginMm + headerHeight : marginMm;

      pdf.addImage(pageImgData, 'PNG', offsetX, offsetY, usableWidth, pageHeightMm, undefined, 'SLOW');
    });

    pdf.save(fileName);
  } finally {
    restoreOriginalDimensions();
  }
}
