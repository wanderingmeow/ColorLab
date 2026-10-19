/**
 * Mounting real components inside the test runner.
 *
 * Some bugs in this app are not about data. A loupe that computes the right position and is
 * still clipped by the top of the window, a Clear button whose handler is correct and whose
 * click never lands, a selected dot that is painted and then covered by its neighbour because
 * SVG has no z-index — none of those can be found by calling the store, and for a long time
 * none of them could be tested at all, so all three were chased by screenshot.
 *
 * The UI test file asks vitest for a `happy-dom` environment; these are the handful of
 * helpers that make a document usable: mount, click, read.
 */

/** Solid flushes its updates in a microtask; one macrotask tick is enough for everything here. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const mounted: (() => void)[] = [];

/** Mount a component into a fresh container and hand back that container. */
export async function mount<T>(component: () => T): Promise<HTMLElement> {
  const { render } = await import('solid-js/web');
  const host = document.createElement('div');
  document.body.appendChild(host);
  mounted.push(render(() => component() as unknown as Node, host));
  await flush();
  return host;
}

/** Find a button by the words on it — the way a person looks for one. */
export function buttonWithText(root: ParentNode, text: string): HTMLElement | undefined {
  return [...root.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes(text));
}

/** Click it the way a user would: a bubbling event, not a direct call to the handler. */
export function click(el: Element | null | undefined): void {
  if (!el) throw new Error('tried to click an element that is not there');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Collapsed text of an element — what a reader would say it says. */
export const textOf = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Tear down every mount and empty the page, so nothing leaks between tests. */
export function clearDom(): void {
  while (mounted.length) mounted.pop()!();
  document.body.innerHTML = '';
}
