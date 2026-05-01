/**
 * Mermaid diagram renderer using a same-origin iframe.
 *
 * The iframe loads a separate extension page (src/mermaid-renderer/) that
 * imports mermaid. This gives mermaid its own clean document context where
 * d3.select("body") correctly finds the SVG elements it creates.
 * No CDN dependency — everything is bundled by Vite.
 */

let iframe: HTMLIFrameElement | null = null;
let initPromise: Promise<void> | null = null;
const pending = new Map<string, { resolve: (svg: string) => void; reject: (err: Error) => void }>();

function handleMessage(event: MessageEvent) {
  if (event.data?.type !== 'mermaid-done' || !event.data.key) return;
  const entry = pending.get(event.data.key);
  if (!entry) return;
  pending.delete(event.data.key);
  if (event.data.error) {
    entry.reject(new Error(event.data.error));
  } else {
    entry.resolve(event.data.svg);
  }
}

function ensureIframe(): Promise<void> {
  if (iframe?.parentNode && initPromise) return initPromise;

  window.addEventListener('message', handleMessage);

  initPromise = new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
    frame.setAttribute('aria-hidden', 'true');
    frame.src = '/src/mermaid-renderer/index.html';

    const timeout = setTimeout(() => {
      reject(new Error('Mermaid renderer load timeout'));
    }, 20000);

    frame.addEventListener('load', () => {
      // Wait for mermaid to initialize inside the iframe
      setTimeout(() => {
        clearTimeout(timeout);
        iframe = frame;
        resolve();
      }, 800);
    }, { once: true });

    frame.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('Mermaid renderer failed to load'));
    }, { once: true });

    document.body.appendChild(frame);
  });

  return initPromise;
}

export async function renderMermaidSvg(source: string): Promise<string> {
  await ensureIframe();

  if (!iframe?.contentWindow) {
    throw new Error('Mermaid renderer not available');
  }

  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<string>((resolve, reject) => {
    pending.set(key, { resolve, reject });

    setTimeout(() => {
      if (pending.has(key)) {
        pending.delete(key);
        reject(new Error('Mermaid render timeout (30s)'));
      }
    }, 30000);

    iframe!.contentWindow!.postMessage({ type: 'render', key, source }, '*');
  });
}
