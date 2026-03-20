import { ClipboardList, House, MessageSquareText, Settings2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'

type MobileTab = 'week' | 'changes' | 'message' | 'more'

export function MobileAppShell({
  children,
  activeTab,
  weekStart,
}: {
  children: React.ReactNode
  activeTab: MobileTab
  weekStart: string
}) {
  return (
    <main className="mobile-shell">
      <div className="mobile-shell-frame">
        <div className="mobile-shell-scroll">
          <div className="mobile-shell-content">{children}</div>
        </div>

        <nav className="bottom-nav" aria-label="Main">
          <Link
            to="/"
            search={{ week: weekStart }}
            className={`bottom-nav-link ${activeTab === 'week' ? 'is-active' : ''}`}
          >
            <House size={18} />
            <span>Week</span>
          </Link>
          <Link
            to="/review"
            search={{ week: weekStart }}
            className={`bottom-nav-link ${activeTab === 'changes' ? 'is-active' : ''}`}
          >
            <ClipboardList size={18} />
            <span>Changes</span>
          </Link>
          <Link
            to="/message"
            search={{ week: weekStart }}
            className={`bottom-nav-link ${activeTab === 'message' ? 'is-active' : ''}`}
          >
            <MessageSquareText size={18} />
            <span>Message</span>
          </Link>
          <Link
            to="/setup"
            className={`bottom-nav-link ${activeTab === 'more' ? 'is-active' : ''}`}
          >
            <Settings2 size={18} />
            <span>More</span>
          </Link>
        </nav>
      </div>
    </main>
  )
}
