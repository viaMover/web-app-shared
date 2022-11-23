module.exports = {
  root: true,
  env: {
    node: true
  },
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint', 'simple-import-sort', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    parser: '@typescript-eslint/parser'
  },
  rules: {
    'simple-import-sort/imports': [
      'error',
      {
        groups: [['^\\u0000'], ['^@?\\w'], ['^@/\\w']]
      }
    ],
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-restricted-syntax': 'off',
    'no-continue': 'off',
    'no-await-in-loop': 'off',
    'import/prefer-default-export': 'off',
    camelcase: 'off',
    'no-underscore-dangle': 'off',
    'class-methods-use-this': 'off',
    quotes: [
      'error',
      'single',
      {
        avoidEscape: true,
        allowTemplateLiterals: true
      }
    ],
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: true,
        printWidth: 100,
        trailingComma: 'none',
        endOfLine: 'lf'
      }
    ],
    'multiline-comment-style': ['error', 'separate-lines'],
    'linebreak-style': ['error', 'unix'],
    'no-multiple-empty-lines': [
      'error',
      {
        max: 1,
        maxEOF: 0,
        maxBOF: 0
      }
    ],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error'
  }
};
