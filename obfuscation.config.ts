export const obfuscationConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 1,
  deadCodeInjectionRandomThreshold: 1,

  debugProtection: true,
  debugProtectionInterval: 3000,
  disableConsoleOutput: true,
  selfDefending: true,

  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: true,

  splitStrings: true,
  splitStringsChunkLength: 4,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 1,
  stringArrayEncoding: ['rc4', 'base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 5,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 1,

  transformObjectKeys: true,
  numbersToExpressions: true,
  unicodeEscapeSequence: true,
  simplify: true,

  renameProperties: true,
  renamePropertiesMode: 'safe',

  optionsPreset: 'high-obfuscation',
  log: false,

  seed: 0,
  sourceMap: false,

  ignoreImports: true,

  exclude: [
    '**/node_modules/**',
    '**/vite.config.*',
    '**/tailwind.config.*',
    '**/*.test.*',
    '**/*.spec.*',
  ],
}
