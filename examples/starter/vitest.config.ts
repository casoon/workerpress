// Unit-Tests (vitest) liegen unter src/. Der `e2e/`-Ordner enthält Playwright-
// Specs (eigener Runner: `pnpm test:e2e`) und darf nicht von vitest geladen werden.
export default {
  test: {
    include: ['src/**/*.test.ts'],
  },
};
