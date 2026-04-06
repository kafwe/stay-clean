import { RefreshCcw } from 'lucide-react'
import type { ReactNode } from 'react'

export function WeekOverviewCard({
  cleansLeft,
  pendingReviewCount,
  cleanerCount,
  nextStepLabel,
  primaryAction,
  syncBusy,
  onSync,
}: {
  cleansLeft: number
  pendingReviewCount: number
  cleanerCount: number
  nextStepLabel: string
  primaryAction: ReactNode
  syncBusy: boolean
  onSync: () => void
}) {
  return (
    <article className="overview-card overview-card-week">
      <div className="overview-copy">
        <p className="eyebrow">This week at a glance</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">Everything set for a smooth week</h2>
        <div className="overview-metrics">
          <span className="overview-metric">
            <strong>{cleansLeft}</strong>
            {cleansLeft === 1 ? 'clean' : 'cleans'}
          </span>
          <span className={`overview-metric ${pendingReviewCount > 0 ? 'is-urgent' : ''}`}>
            <strong>{pendingReviewCount}</strong>
            {pendingReviewCount === 1 ? 'item to review' : 'items to review'}
          </span>
          <span className="overview-metric">
            <strong>{cleanerCount}</strong>
            {cleanerCount === 1 ? 'cleaner' : 'cleaners'}
          </span>
        </div>
        <div className={`overview-next-step ${pendingReviewCount > 0 ? 'is-urgent' : ''}`}>
          <span className="overview-next-step-label">Next step</span>
          <p>{nextStepLabel}</p>
        </div>
      </div>

      <div className="overview-actions overview-actions-priority">
        {primaryAction}
        <button type="button" className="action-secondary" disabled={syncBusy} onClick={onSync}>
          <RefreshCcw size={16} />
          {syncBusy ? 'Refreshing...' : 'Refresh bookings'}
        </button>
      </div>
    </article>
  )
}
