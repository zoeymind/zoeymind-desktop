import aimindBase from '@zoeymind/eslint-config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...aimindBase,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      'no-console': 'off' // logger library needs console
    }
  },
  {
    files: ['*.js', '*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  }
)
