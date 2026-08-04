const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Express type augmentation requires `declare global { namespace Express { ... } }`.
    files: ['src/types/index.ts'],
    rules: { '@typescript-eslint/no-namespace': 'off' },
  },
  {
    // Jest global setup/teardown run as plain CommonJS Node scripts, outside ts-jest.
    files: ['src/tests/*.js'],
    languageOptions: { globals: { require: 'readonly', module: 'readonly', process: 'readonly', __dirname: 'readonly' } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  }
);
