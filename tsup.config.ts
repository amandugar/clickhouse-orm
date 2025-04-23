import { defineConfig } from 'tsup'

export default defineConfig([
  // ESM build for the main library
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: { entry: 'src/index.ts' },
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    outDir: 'dist',
  },
  // CJS build for CLI
  {
    entry: ['src/cli/index.ts'],
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: true,
    minify: true,
    external: ['ts-node'],
    outDir: 'dist/cli',
  },
])
