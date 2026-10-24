import { LinkButton } from './LinkButton'
import { useAuth } from '../auth/AuthContext'

export function SiteHeader() {
  const { session } = useAuth()
  return (
    <header className="site-header" id="top">
      <div className="page-shell header-inner">
        <a className="wordmark" href="#top" aria-label="SpeakDaily home">Speak<span>Daily</span></a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#topics">Today’s prompt</a>
          <a href="/signin">Sign in</a>
          <LinkButton href={session ? '/app' : '/signup'} className="header-cta">{session ? 'Go to your practice' : 'Start free practice'} <span aria-hidden="true">↗</span></LinkButton>
        </nav>
      </div>
    </header>
  )
}
