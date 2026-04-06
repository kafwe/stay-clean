import { ClipboardList, House, Settings2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useRef } from 'react'

type MobileTab = 'week' | 'changes' | 'more' | null

export function MobileAppShell({
  children,
  activeTab,
  weekStart,
  pendingReviewCount = 0,
  floatingAction,
  onSwipeLeft,
  onSwipeRight,
}: {
  children: React.ReactNode
  activeTab: MobileTab
  weekStart: string
  pendingReviewCount?: number
  floatingAction?: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const touchStateRef = useRef<{
    startX: number
    startY: number
    swiping: boolean
    interactive: boolean
  } | null>(null)

  const triggerHaptic = useEffectEvent(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  })

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const actionable = target.closest('button, a, summary, [role="button"]')
      if (!actionable) {
        return
      }

      if (
        actionable instanceof HTMLButtonElement &&
        actionable.disabled
      ) {
        return
      }

      triggerHaptic()
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [triggerHaptic])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || (!onSwipeLeft && !onSwipeRight)) {
      return
    }

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      const target = event.target
      const interactive =
        target instanceof Element &&
        Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))

      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        swiping: false,
        interactive,
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      const state = touchStateRef.current
      if (!state || state.interactive) {
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - state.startX
      const deltaY = touch.clientY - state.startY

      if (Math.abs(deltaX) > 14 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        state.swiping = true
        event.preventDefault()
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      const state = touchStateRef.current
      touchStateRef.current = null

      if (!state || state.interactive) {
        return
      }

      const touch = event.changedTouches[0]
      const deltaX = touch.clientX - state.startX
      const deltaY = touch.clientY - state.startY

      if (!state.swiping || Math.abs(deltaX) < 72 || Math.abs(deltaY) > 56) {
        return
      }

      triggerHaptic()

      if (deltaX < 0) {
        onSwipeLeft?.()
        return
      }

      onSwipeRight?.()
    }

    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', onTouchEnd)
    }
  }, [onSwipeLeft, onSwipeRight, triggerHaptic])

  return (
    <main className="mobile-shell">
      <div className="mobile-shell-frame">
        <div ref={scrollRef} className="mobile-shell-scroll">
          <div className="mobile-shell-content">{children}</div>
        </div>

        {floatingAction ? <div className="mobile-shell-fab">{floatingAction}</div> : null}

        <div className="bottom-nav-wrap">
          <nav className="bottom-nav" aria-label="Main">
            <Link
              to="/"
              search={(prev) => ({ ...prev, week: weekStart })}
              className={`bottom-nav-link ${activeTab === 'week' ? 'is-active' : ''}`}
            >
              <House size={18} />
              <span>Week</span>
            </Link>
            <Link
              to="/review"
              search={(prev) => ({ ...prev, week: weekStart })}
              className={`bottom-nav-link ${activeTab === 'changes' ? 'is-active' : ''} ${pendingReviewCount > 0 ? 'has-alert' : ''}`}
            >
              <span className="bottom-nav-icon-wrap">
                <ClipboardList size={18} />
                {pendingReviewCount > 0 ? (
                  <span className="bottom-nav-badge" aria-label={`${pendingReviewCount} review items waiting`}>
                    {pendingReviewCount > 9 ? '9+' : pendingReviewCount}
                  </span>
                ) : null}
              </span>
              <span>Review</span>
            </Link>
            <Link
              to="/setup"
              search={(prev) => ({ ...prev, week: weekStart })}
              className={`bottom-nav-link ${activeTab === 'more' ? 'is-active' : ''}`}
            >
              <Settings2 size={18} />
              <span>Tools</span>
            </Link>
          </nav>
        </div>
      </div>
    </main>
  )
}
