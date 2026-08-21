import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /* Optional dev-only proxy.
   *
   * api.mailsfinder.com does not send Access-Control-Allow-Origin for
   * localhost, so a browser on localhost cannot call it directly — the
   * preflight is blocked before the request is made. Setting
   * VITE_DEV_PROXY_TARGET makes the browser talk to the Vite origin instead
   * and lets Vite forward server-side, where CORS does not apply.
   *
   * Pair it with an EMPTY VITE_API_BASE_URL so requests are relative:
   *   VITE_API_BASE_URL=
   *   VITE_DEV_PROXY_TARGET=https://api.mailsfinder.com
   *
   * Inert unless the variable is set, and it has no effect on the build. */
  const proxyTarget = env.VITE_DEV_PROXY_TARGET

  return {
  // Tailwind v4 runs as a Vite plugin. Deliberately NOT the PostCSS route:
  // this repo has no postcss.config and should not gain one.
  plugins: [react(), tailwindcss()],
  resolve: {
    // The ported shadcn primitives import `@/lib/utils` and `@/components/ui/*`.
    // Must stay in sync with `paths` in tsconfig.json.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    https: false,
    ...(proxyTarget
      ? {
          proxy: {
            '/api': { target: proxyTarget, changeOrigin: true, secure: true }
          }
        }
      : {})
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
          // `clsx` and `tailwind-merge` back cn(), so every component imports
          // them; `clsx` is ALSO a recharts dependency. Left unassigned they
          // can land in the `charts` chunk, which then becomes a static
          // dependency of the entry and drags ~350KB of recharts onto every
          // route. Both are pure functions with no React import, so they
          // belong here.
          if (
            id.includes('commonjsHelpers') ||
            id.includes('vite/preload-helper') ||
            /[\\/]node_modules[\\/](react-is|object-assign|clsx|tailwind-merge)[\\/]/.test(id)
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
          // Packages reachable exclusively from the lazy chart modules.
          //
          // recharts 3 has a far bigger dependency tree than v2 did — it pulls
          // @reduxjs/toolkit, react-redux, immer, reselect, es-toolkit and
          // eventemitter3. Those must be listed here or Rollup is free to place
          // them with the entry, which makes `charts` a static dependency and
          // preloads recharts on every route.
          //
          // Deliberately NOT here: `clsx` and `use-sync-external-store`. Both
          // are recharts dependencies but are also used by the eager graph
          // (cn() and react-vendor respectively), so claiming them for `charts`
          // would recreate the same problem in reverse.
          if (
            /[\\/]node_modules[\\/](recharts|recharts-scale|react-smooth|d3-[a-z]+|victory-vendor|internmap|decimal\.js-light|@reduxjs[\\/]toolkit|react-redux|immer|reselect|es-toolkit|eventemitter3|fast-equals|tiny-invariant)[\\/]/.test(id)
          ) {
            return 'charts'
          }
          if (/[\\/]node_modules[\\/](react-markdown|remark-|rehype-|micromark|mdast-|hast-|unist-|unified|vfile|property-information|space-separated-tokens|comma-separated-tokens|character-entities|decode-named-character-reference|trim-lines|bail|is-plain-obj|trough|devlop|zwitch|longest-streak|ccount|markdown-table|escape-string-regexp|html-url-attributes)/.test(id)) {
            return 'markdown'
          }
          if (/[\\/]node_modules[\\/](crypto-js)[\\/]/.test(id)) {
            return 'crypto'
          }
          return undefined
        }
      }
    },
    chunkSizeWarningLimit: 900
  }
  }
})
