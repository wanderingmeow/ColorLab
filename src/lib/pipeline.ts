import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { sampler } from './image.ts';
import {
  loadFile, pixelsReady, pixelsSrc, photo, resampleAll, reanalysis, samples, setPhoto,
  setPixelsSrc, setProminence, setSamples, setSelected, setStep, undo,
} from './store.ts';

/**
 * Everything that happens to a photograph between "it is in the page" and "it can be read".
 *
 * These effects are the whole pipeline and they are the parts that must keep running
 * whichever step is on screen, so they belong to the shell rather than to a view. Each one
 * is here because it fixed something that silently did nothing.
 */
export function usePhotoPipeline() {
  const [edited, setEdited] = createSignal<string | null>(null);

  /*
   * An <img> paints from its data URL before the sampler has pixels to read, and every click
   * in that window samples nothing and silently does nothing. This is the only place a photo
   * becomes pixels: upload, paste and drop all just set the photo signal, and everything
   * else waits on pixelsReady().
   */
  createEffect(() => {
    const p = photo();
    if (!p) { setPixelsSrc(null); return; }
    if (pixelsSrc() === p.src) return;
    void sampler.load(p.src)
      .then(() => setPixelsSrc(p.src))
      // a photo that will not decode is no photo: fall back to the upload screen
      .catch(() => { setPixelsSrc(null); setPhoto(null); setSamples([]); setStep('sample'); });
  });

  /*
   * New photo, same points: their locations still line up, their colours belong to the
   * photo that was here before. Re-read them once the new pixels are in.
   */
  createEffect(() => {
    const src = pixelsSrc();
    if (src && src === photo()?.src) resampleAll();
  });

  // frame-area weights for the harmony score
  createEffect(() => {
    const list = samples();
    if (!pixelsReady() || !list.length) { setProminence({}); return; }
    const timer = setTimeout(
      () => setProminence(sampler.prominence(list.map((s) => ({ id: s.id, hex: s.hex })))), 120);
    clearTimeout(timer);
  });

  // the screenshot back from the editor is meant to be graded — no "this is a render" nag
  const reanalysing = () => reanalysis() !== null && reanalysis() === photo()?.src;

  createEffect(() => {
    const p = photo();
    setEdited(p && pixelsReady() && !reanalysing() ? (sampler.looksEdited()?.cast ?? null) : null);
  });

  return { reanalysing, edited };
}

/**
 * Keyboard, paste and drop, bound to the window.
 *
 * The drop guard is not politeness: a file dropped anywhere but on the photo is opened by
 * the browser as a document, the page navigates away, and the photo — which is stored
 * nowhere — is gone with it. Capture phase, so the photo's own handler runs first and this
 * only catches what it left.
 */
export function useWindowShortcuts(onEscape: () => void): void {
  const onPaste = (e: ClipboardEvent) => {
    const file = Array.from(e.clipboardData?.files ?? [])[0];
    if (!file) return;
    e.preventDefault();
    // same path as a drop on the canvas; a paste that is not an image is simply ignored
    loadFile(file).catch(() => { /* not an image we can read */ });
  };
  const guardFiles = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); };
  const onKey = (e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); undo(); }
    if (e.key === 'Escape') { onEscape(); setSelected(null); }
  };
  onMount(() => {
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    window.addEventListener('dragover', guardFiles);
    window.addEventListener('drop', guardFiles, { capture: true });
  });
  onCleanup(() => {
    window.removeEventListener('paste', onPaste);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('dragover', guardFiles);
    window.removeEventListener('drop', guardFiles, { capture: true });
  });
}
