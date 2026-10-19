import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site under /<repo>/, so a build has to ask for its assets
  // there. The dev server keeps its root so localhost stays localhost.
  base: command === 'build' ? '/ColorLab/' : '/',
  plugins: [solid(), tailwindcss()],
  server: { port: 5173 },
  build: { target: 'esnext' },
}));
