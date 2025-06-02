import { defineConfig, type UserConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// Main library build config
const libConfig: UserConfig = {
  build: {
    lib: {
      entry: resolve(__dirname, 'src/parser.ts'),
      name: 'MTextParser',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => `parser.${format}.js`,
    },
    sourcemap: true,
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    dts({
      outDir: 'dist/types',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    }),
  ],
};

// Example build config
const exampleConfig: UserConfig = {
  build: {
    lib: {
      entry: resolve(__dirname, 'src/example.ts'),
      formats: ['cjs'],
      fileName: () => 'node/example.cjs.js',
    },
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: false,
  },
};

export default defineConfig(({ command, mode }) => {
  if (mode === 'example') {
    return exampleConfig;
  }
  return libConfig;
}); 