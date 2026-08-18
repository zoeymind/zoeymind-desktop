import aimindBase from '@zoeymind/eslint-config'
import tseslint from 'typescript-eslint'

export default tseslint.config(...aimindBase, {
  files: ['src/**/*.ts'],
  languageOptions: {
    globals: {
      console: 'readonly',
      process: 'readonly',
      Buffer: 'readonly'
    }
  }
})
