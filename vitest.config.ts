import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';

/**
 * One runner for both kinds of test.
 *
 * The logic tests (`environment: 'node'`) import the store and the colour engine directly and
 * never touch a document. The UI tests ask for `happy-dom` with a docblock of their own, so a
 * component can be mounted, clicked and read — the only way to find out whether a click
 * landed or a loupe was clipped. `node:assert` is kept everywhere: the assertions are the
 * same ones the suite had before this runner existed.
 */
export default defineConfig({
  // the real Solid compiler, so the components under test are the ones that ship
  plugins: [solid()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
