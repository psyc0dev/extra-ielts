import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import obfuscator from 'rollup-plugin-obfuscator'
import utwm from 'unplugin-tailwindcss-mangle/vite'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import viteCompression from 'vite-plugin-compression'

import { obfuscationConfig } from './obfuscation.config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ['**/server/**', '**/src-tauri/**'],
      },
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react({
        babel: {
          babelrc: true,
        },
      }),
      tailwindcss(),
      mode === 'production' &&
        obfuscator({
          ...obfuscationConfig,
        }),
      utwm(),
      viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        deleteOriginFile: false,
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        deleteOriginFile: false,
      }),
    ],
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
      outDir: 'dist',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (
                id.includes('node_modules/react/') ||
                id.includes('node_modules/react-dom/') ||
                id.includes('node_modules/scheduler/') ||
                id.includes('react-router')
              ) {
                return 'react-core'
              }
              if (
                id.includes('@radix-ui') ||
                id.includes('@floating-ui') ||
                id.includes('@base-ui') ||
                id.includes('@heroui') ||
                id.includes('@mui') ||
                id.includes('@emotion') ||
                id.includes('motion') ||
                id.includes('framer-motion') ||
                id.includes('class-variance-authority') ||
                id.includes('clsx') ||
                id.includes('tailwind-merge')
              ) {
                return 'ui-vendor'
              }
              if (id.includes('lucide-react') || id.includes('react-icons')) {
                return 'icons'
              }
              if (id.includes('@lottiefiles') || id.includes('dotlottie')) {
                return 'lottie'
              }
              return 'vendor'
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  }
})
