import { Show, createSignal } from 'solid-js';
import { HarmonyView } from './components/HarmonyView.tsx';
import { HelpDrawer } from './components/HelpDrawer.tsx';
import { SampleView } from './components/SampleView.tsx';
import { TopBar } from './components/TopBar.tsx';
import { usePhotoPipeline, useWindowShortcuts } from './lib/pipeline.ts';
import { initStore, step } from './lib/store.ts';

/**
 * The shell: a top bar, whichever step is on screen, and the help sheet.
 *
 * The photo pipeline and the window shortcuts are started here rather than in a view —
 * a photograph has to keep decoding, weighting and warning while you move between the two
 * steps, and neither ⌘Z nor a stray file drop should depend on which one is visible.
 */
export function App() {
  initStore();
  const [help, setHelp] = createSignal(false);
  const work = usePhotoPipeline();
  useWindowShortcuts(() => setHelp(false));

  return (
    <div class="min-h-full flex flex-col">
      <TopBar onHelp={() => setHelp(true)} />

      <main class="mx-auto w-full max-w-[1440px] flex-1 px-6 py-7">
        <Show when={step() === 'sample'}>
          <SampleView reanalysing={work.reanalysing} edited={work.edited} />
        </Show>
        <Show when={step() === 'harmony'}>
          <HarmonyView />
        </Show>
      </main>

      <HelpDrawer open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
