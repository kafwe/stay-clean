import { ClipboardList, House, Settings2 } from 'lucide-react'
import { Link, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import { plannerNavOptions } from '#/lib/planner-navigation'

type MobileTab = 'week' | 'changes' | 'more' | null

const plannerTabs: Array<Exclude<MobileTab, null>> = ['week', 'changes', 'more']

function getAdjacentTab(activeTab: MobileTab, direction: -1 | 1): Exclude<MobileTab, null> | null {
  if (!activeTab) {
    return null
  }

  const currentIndex = plannerTabs.indexOf(activeTab)
  if (currentIndex === -1) {
    return null
  }

  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= plannerTabs.length) {
    return null
  }

  return plannerTabs[nextIndex]
}

export function MobileAppShell({
  children,
  activeTab,
  weekStart,
  pendingReviewCount = 0,
  floatingAction,
}: {
  children: React.ReactNode
  activeTab: MobileTab
  weekStart: string
  pendingReviewCount?: number
  floatingAction?: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const touchStateRef = useRef<{
    startX: number
    startY: number
    swiping: boolean
    interactive: boolean
  } | null>(null)
  const wheelStateRef = useRef<{
    direction: -1 | 0 | 1
    distance: number
    lastEventAt: number
  }>({
    direction: 0,
    distance: 0,
    lastEventAt: 0,
  })
  const router = useRouter()
  const navOptions = plannerNavOptions(weekStart)

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  }, [])

  const navigateToAdjacentTab = useCallback(
    (direction: -1 | 1) => {
      const nextTab = getAdjacentTab(activeTab, direction)
      if (!nextTab) {
        return
      }

      triggerHaptic()

      const destination =
        nextTab === 'week' ? navOptions.week : nextTab === 'changes' ? navOptions.changes : navOptions.more

      void router.navigate(destination)
    },
    [activeTab, navOptions, router, triggerHaptic],
  )

  useEffect(() => {
    const element = scrollRef.current
    if (!element) {
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

      if (deltaX < 0) {
        navigateToAdjacentTab(1)
        return
      }

      navigateToAdjacentTab(-1)
    }

    const onWheel = (event: WheelEvent) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable="true"], [data-no-tab-swipe]')
      ) {
        return
      }

      const horizontalDistance = Math.abs(event.deltaX)
      const verticalDistance = Math.abs(event.deltaY)

      if (horizontalDistance < 8 || horizontalDistance < verticalDistance * 1.15) {
        return
      }

      const direction: -1 | 1 = event.deltaX > 0 ? 1 : -1
      const now = performance.now()
      const wheelState = wheelStateRef.current

      if (wheelState.direction !== direction || now - wheelState.lastEventAt > 220) {
        wheelState.direction = direction
        wheelState.distance = 0
      }

      wheelState.distance += horizontalDistance
      wheelState.lastEventAt = now

      if (wheelState.distance < 88) {
        return
      }

      wheelState.distance = 0
      event.preventDefault()
      navigateToAdjacentTab(direction)
    }

    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd, { passive: true })
    element.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', onTouchEnd)
      element.removeEventListener('wheel', onWheel)
    }
  }, [navigateToAdjacentTab])

  const handleTabClick = useCallback(() => {
    triggerHaptic()
  }, [triggerHaptic])

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
              {...navOptions.week}
              className={`bottom-nav-link ${activeTab === 'week' ? 'is-active' : ''}`}
              onClick={handleTabClick}
            >
              <House size={18} />
              <span>Week</span>
            </Link>
            <Link
              {...navOptions.changes}
              className={`bottom-nav-link ${activeTab === 'changes' ? 'is-active' : ''} ${pendingReviewCount > 0 ? 'has-alert' : ''}`}
              onClick={handleTabClick}
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
              {...navOptions.more}
              className={`bottom-nav-link ${activeTab === 'more' ? 'is-active' : ''}`}
              onClick={handleTabClick}
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
