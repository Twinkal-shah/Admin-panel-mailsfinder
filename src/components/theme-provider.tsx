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
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      /* Two attributes on purpose, for exactly as long as both style systems
       * coexist. shadcn tokens key off the `.dark` CLASS; the legacy
       * src/styles/ui.css keys every --mf-* token off a `[data-theme]`
       * ATTRIBUTE. Driving both from one source keeps the not-yet-converted
       * Antd pages correctly themed instead of silently losing every colour
       * variable. Drop 'data-theme' when ui.css is deleted at the end of
       * stage 2. */
      attribute={['class', 'data-theme']}
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
