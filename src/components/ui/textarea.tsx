import * as React from "react"

import { cn } from "@/lib/utils"

/* REACT 18 COMPATIBILITY (deviation from the upstream kit, which targets React
 * 19 where `ref` is an ordinary prop). Leaf form controls are ref targets by
 * nature: react-hook-form's `register()` returns a ref, and Base UI triggers
 * pass one to whatever they render. Without forwardRef, React 18 logs
 * "Function components cannot be given refs" and drops it, so the field is
 * never registered and its value never reaches the form. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
})

export { Textarea }
