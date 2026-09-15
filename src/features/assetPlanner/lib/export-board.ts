import { toPng, getFontEmbedCSS } from "html-to-image";
import { jsPDF } from "jspdf";

function timestamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}

async function renderPng(node: HTMLElement): Promise<{ dataUrl: string; width: number; height: number }> {
  // The board uses web fonts (Barlow Condensed / IBM Plex Mono) with tight
  // line-heights (leading-none). If html-to-image rasterizes before those fonts
  // are embedded, the SVG falls back to a font with different metrics and the
  // glyphs bleed out of their boxes — headers end up overlapping the rows below.
  // Wait for the fonts, then pre-embed them so the capture matches the live DOM.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // fonts API unavailable / rejected — fall through and capture anyway
    }
  }

  let fontEmbedCSS: string | undefined;
  try {
    fontEmbedCSS = await getFontEmbedCSS(node);
  } catch {
    fontEmbedCSS = undefined;
  }

  // pixelRatio 2 keeps it crisp; background matches the app surface.
  const options = {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    ...(fontEmbedCSS ? { fontEmbedCSS, skipFonts: true } : {}),
  };

  // First pass warms html-to-image's font/image embed cache. The first capture
  // after load can rasterize before fonts/images resolve, which shifts text and
  // makes headers overlap; the second pass renders from the warm cache cleanly.
  await toPng(node, options);
  const dataUrl = await toPng(node, options);
  return { dataUrl, width: node.scrollWidth, height: node.scrollHeight };
}

/** Exports a DOM node as a downloadable PNG. */
export async function exportNodeToPng(node: HTMLElement, name = "quadro"): Promise<void> {
  const { dataUrl } = await renderPng(node);
  const link = document.createElement("a");
  link.download = `${name}-${timestamp()}.png`;
  link.href = dataUrl;
  link.click();
}

/** Exports a DOM node as a single-page PDF sized to the board. */
export async function exportNodeToPdf(node: HTMLElement, name = "quadro"): Promise<void> {
  const { dataUrl, width, height } = await renderPng(node);
  const orientation = width >= height ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "px", format: [width, height] });
  pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
  pdf.save(`${name}-${timestamp()}.pdf`);
}


