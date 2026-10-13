import config from '../config/eslint.config.mjs'

export default [
  ...config,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]
