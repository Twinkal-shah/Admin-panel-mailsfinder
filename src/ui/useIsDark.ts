import { useEffect, useState } from 'react'

function readTheme(): boolean {
  if (typeof document === 'undefined') return true
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

/**
 * Reactive replacement for the `document.documentElement.getAttribute(...)`
 * reads scattered through the pages. Those were evaluated during render and
 * never re-subscribed, so toggling the theme left charts and status tags on
 * their old palette until the component happened to remount.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(readTheme)

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setIsDark(readTheme()))
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    setIsDark(readTheme())
    return () => observer.disconnect()
  }, [])

  return isDark
}
