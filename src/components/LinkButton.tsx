import type { AnchorHTMLAttributes, ReactNode } from 'react'

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
}

export function LinkButton({ children, className = '', ...props }: LinkButtonProps) {
  return <a className={`button-link ${className}`.trim()} {...props}>{children}</a>
}
