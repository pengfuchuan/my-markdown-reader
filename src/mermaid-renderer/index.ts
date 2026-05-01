import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  htmlLabels: false,
});

window.addEventListener('message', async (e) => {
  if (!e.data || e.data.type !== 'render') return;
  const { key, source } = e.data;
  try {
    const id = `mmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { svg } = await mermaid.render(id, source);
    // Clean up temp elements mermaid left in this iframe's body
    document.getElementById(id)?.remove();
    document.getElementById('d' + id)?.remove();
    parent.postMessage({ type: 'mermaid-done', key, svg }, '*');
  } catch (err) {
    parent.postMessage({
      type: 'mermaid-done',
      key,
      error: err instanceof Error ? err.message : String(err),
    }, '*');
  }
});
