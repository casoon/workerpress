// `templates/` enthält ein Beispielprojekt mit eigenen (Playwright-)Specs —
// nicht Teil der Unit-Tests dieses Pakets. Plain-Object-Config, damit kein
// zusätzlicher Import nötig ist.
export default {
  test: {
    include: ['src/**/*.test.ts'],
  },
};
