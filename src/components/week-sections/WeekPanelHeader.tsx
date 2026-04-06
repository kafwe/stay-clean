import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ScheduleStatus } from '#/lib/types'

export function getWeekStatusLabel(status: string | null) {
  if (status === 'confirmed') {
    return 'Confirmed'
  }

  if (status === 'needs_review') {
    return 'Needs review'
  }

  if (status === 'draft') {
    return 'Draft ready'
  }

  return 'Setting up'
}

export function WeekPanelHeader({
  eyebrow = 'This week',
  title,
  status,
  showStatus = true,
  showWeekControls = true,
  showThisWeekButton,
  onPrevious,
  onCurrent,
  onNext,
  children,
}: {
  eyebrow?: string
  title: string
  status: ScheduleStatus | null
  showStatus?: boolean
  showWeekControls?: boolean
  showThisWeekButton: boolean
  onPrevious: () => void
  onCurrent: () => void
  onNext: () => void
  children?: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="compact-hero sticky-mobile-header">
        <div className="compact-hero-top">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display-title mt-1 text-[1.55rem] leading-[0.96] text-[var(--ink-strong)]">
              {title}
            </h1>
          </div>
          {showStatus ? <span className="status-pill status-pill-compact">{getWeekStatusLabel(status)}</span> : null}
        </div>

        {showWeekControls ? (
          <div className="compact-switcher">
            <button type="button" className="icon-button" onClick={onPrevious} aria-label="Earlier week">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="action-ghost flex-1" onClick={onCurrent} disabled={!showThisWeekButton}>
              This week
            </button>
            <button type="button" className="icon-button" onClick={onNext} aria-label="Later week">
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}
      </div>

      {children ? <div className="week-header-body space-y-3">{children}</div> : null}
    </section>
  )
}
