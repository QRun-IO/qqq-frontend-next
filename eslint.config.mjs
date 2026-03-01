import nextConfig from 'eslint-config-next'
import prettierConfig from 'eslint-config-prettier'
import jsdoc from 'eslint-plugin-jsdoc'

const eslintConfig = [
  ...nextConfig,
  prettierConfig,
  {
    rules: {
      // React Compiler rules — project does not use React Compiler; disable to avoid false positives
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/globals': 'off',
    },
  },

  // ---------------------------------------------------------------------------
  // JSDoc enforcement — all TypeScript source files except tests and stories
  // ---------------------------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/**/*.stories.{ts,tsx}',
    ],
    plugins: { jsdoc },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
    rules: {
      // Require JSDoc on all exported functions, classes, and methods
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: false,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false, // too noisy for inline callbacks
            FunctionExpression: false,      // too noisy for inline expressions
          },
          checkConstructors: false, // constructors documented on the class
          contexts: [
            // Exported arrow functions assigned to a const
            'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
            'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
          ],
          enableFixer: false,
        },
      ],

      // Every JSDoc block must have a non-empty description
      'jsdoc/require-description': ['error', { descriptionStyle: 'any' }],

      // Params and returns
      'jsdoc/require-param': ['error', { checkDestructured: false }],
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': ['error', { forceReturnsWithAsync: false }],
      'jsdoc/require-returns-description': 'error',

      // Correctness checks
      'jsdoc/check-param-names': ['error', { checkDestructured: false }],
      'jsdoc/check-tag-names': ['error', { typed: true }],
      'jsdoc/no-undefined-types': 'off', // too many false positives with complex TS generics

      // File-level overview
      'jsdoc/require-file-overview': 'error',
    },
  },
]

export default eslintConfig
