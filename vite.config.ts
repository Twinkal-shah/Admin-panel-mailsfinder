import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: false
  },
  build: {
    // The app shipped as one ~1.9MB chunk, so nothing painted until the whole
    // thing downloaded and parsed. Split the heavy, independently-cacheable
    // libraries out so the shell can boot without recharts/markdown.
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vite's synthetic CJS-interop module and the pure-CJS helpers are
          // imported from *both* the entry graph and the lazy chart graph.
          // Left unassigned, Rollup parked them inside `charts`, which made
          // recharts a static import of the entry — it got preloaded on every
          // route. Pinning them to a tiny always-loaded chunk keeps the lazy
          // graphs genuinely lazy.
          //
          // Only modules that do NOT import React may live here. Putting a
          // React-consuming shim (e.g. use-sync-external-store) in this chunk
          // makes `shared` ⇄ `react-vendor` circular, and the shim evaluates
          // before React is initialised — "Cannot read properties of undefined
          // (reading 'useState')" at runtime in the production build only.
          if (
            id.includes('commonjsHelpers') ||
            id.includes('vite/preload-helper') ||
            /[\\/]node_modules[\\/](react-is|object-assign)[\\/]/.test(id)
          ) {
            return 'shared'
          }
          if (!id.includes('node_modules')) return
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|use-sync-external-store)[\\/]/.test(
              id
            )
          ) {
            return 'react-vendor'
          }
          // Only packages reachable exclusively from the lazy chart modules.
          // `fast-equals`/`eventemitter3` are also pulled in by rc-* widgets,
          // so grouping them here made the whole charts chunk a static
          // dependency of the entry and it got preloaded on every route.
          if (/[\\/]node_modules[\\/](recharts|d3-[a-z]+|victory-vendor|internmap|decimal\.js-light)[\\/]/.test(id)) {
            return 'charts'
          }
          if (/[\\/]node_modules[\\/](react-markdown|remark-|rehype-|micromark|mdast-|hast-|unist-|unified|vfile|property-information|space-separated-tokens|comma-separated-tokens|character-entities|decode-named-character-reference|trim-lines|bail|is-plain-obj|trough|devlop|zwitch|longest-streak|ccount|markdown-table|escape-string-regexp|html-url-attributes)/.test(id)) {
            return 'markdown'
          }
          if (/[\\/]node_modules[\\/](crypto-js)[\\/]/.test(id)) {
            return 'crypto'
          }
          // antd is deliberately NOT forced into one chunk — letting Rollup
          // split it lets each lazy route pull only the widgets it uses.
          return undefined
        }
      }
    },
    chunkSizeWarningLimit: 900
  }
})
