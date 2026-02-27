import nextConfig from 'eslint-config-next'
import prettierConfig from 'eslint-config-prettier'

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
    },
  },
]

export default eslintConfig
