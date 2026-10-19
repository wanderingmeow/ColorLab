import { createSignal } from 'solid-js';

/** Copy-to-clipboard with a non-secure-context fallback and a "copied" flash. */
export function useCopy(timeout = 1200) {
  const [copied, setCopied] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy(text: string, key = text) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
    } catch { /* clipboard blocked — the value is still on screen */ }
    setCopied(key);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(null), timeout);
  }
  return { copied, copy };
}
