import type { HTMLAttributes, ReactNode } from 'react'

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
  ariaLabelledBy: string
}

export function Section({ children, className = '', ariaLabelledBy, ...props }: SectionProps) {
  return (
    <section className={`page-shell content-section ${className}`.trim()} aria-labelledby={ariaLabelledBy} {...props}>
      {children}
    </section>
  )
}
