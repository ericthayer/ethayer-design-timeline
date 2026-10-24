import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const htmlSinks = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'].map((property) => ({
  property,
  message: 'Constitution II.3: build DOM with createElement, <template>, and textContent.',
}));

export default defineConfig(
  { ignores: ['dist', 'node_modules', 'public', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-properties': ['error', ...htmlSinks],
    },
  },
  {
    // Spec 004 admin-auth FR-356: nothing on the token's path may log.
    files: ['src/admin/**', 'src/core/auth/**', 'src/components/admin-*/**'],
    rules: { 'no-console': 'error' },
  },
  {
    // The editor imports the frame-src list from here (spec 004 edit-layer X2).
    files: ['scripts/csp.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['node:*'], message: 'scripts/csp.ts must run in the browser too.' }],
        },
      ],
    },
  },
  { files: ['eslint.config.js'], extends: [tseslint.configs.disableTypeChecked] },
);
