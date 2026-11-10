import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

// Deliberately separate from vite.config.js.
//
// That file is upstream's library build and we should expect to merge changes
// to it; keeping our test configuration out of it means a merge from upstream
// touches nothing of ours. The same reasoning keeps the fixture app out of
// src/main.jsx.
//
// Tests import from src/ rather than dist/, so a run needs no build and a
// failure points at a line of source. The one thing this cannot do is layout:
// jsdom reports every getBoundingClientRect as zeroes, so anything about where
// an element actually lands belongs in test/browser/ instead.
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/setup.js'],
        include: ['test/**/*.test.jsx'],
        // test/browser/ drives a real Chrome from python; it is not vitest's.
        exclude: ['test/browser/**', 'node_modules/**'],
    },
})
