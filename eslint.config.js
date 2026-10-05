const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'dist/**', '.omc/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions, module: 'readonly' }
    }
  },
  {
    files: ['src/background/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.webextensions } }
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } }
  },
  {
    // Callbacks passed to page.evaluate / worker.evaluate run in the browser.
    files: ['tests/e2e/**/*.js', 'tests/e2e-firefox/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.webextensions } }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser, ...globals.webextensions } }
  }
];
