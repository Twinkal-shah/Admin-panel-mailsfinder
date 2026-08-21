import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

/**
 * Applies the `.dark` class to <html>, which is the selector every shadcn token
 * keys off (`@custom-variant dark (&:is(.dark *))` in globals.css).
 *
 * `next-themes` is framework-agnostic despite the name — its only peers are
 * react/react-dom and it imports nothing from Next. Using it rather than a
 * hand-rolled provider means the ported `ui/sonner.tsx`, which reads
 * `useTheme()`, works unmodified.
 *
 * `storageKey` is deliberately the existing `theme` key: the old
 * implementation wrote the same 'light' | 'dark' strings, so anyone who had
 * already chosen light keeps it and no migration shim is needed.
 *
 * Only the class is applied now. The `data-theme` attribute existed solely for
 * the legacy ui.css `--mf-*` tokens, and that sheet is gone.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="theme"
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
