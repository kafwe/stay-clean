import { DayCard } from './DayCard'
import type { ScheduleDayGroup } from '#/lib/types'
import type { AnnotatedDayGroup } from '../week-model'

export function WeeklyPlanPanel({
  activeGroups,
  emptyGroups,
  openDay,
  todayIso,
  onToggleDay,
  onSelectAssignment,
  onAddJob,
}: {
  activeGroups: AnnotatedDayGroup[]
  emptyGroups: AnnotatedDayGroup[]
  openDay: string | null
  todayIso: string
  onToggleDay: (date: string) => void
  onSelectAssignment: (row: ScheduleDayGroup['rows'][number]) => void
  onAddJob: (date: string) => void
}) {
  return (
    <>
      <article className="ledger-panel rounded-[1.75rem] p-4 panel-feature">
        <div className="section-head">
          <div>
            <p className="eyebrow">What to handle first</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Weekly plan</h2>
          </div>
          <p className="section-copy">Past-due days, changed days, and today are shown first.</p>
        </div>

        <div className="mt-5 space-y-3">
          {activeGroups.map(({ group, badges, tone }) => (
            <DayCard
              key={group.date}
              group={group}
              open={openDay === group.date}
              isToday={group.date === todayIso}
              badges={badges}
              tone={tone}
              onToggle={() => onToggleDay(group.date)}
              onRowSelect={onSelectAssignment}
              onAddJob={onAddJob}
            />
          ))}
        </div>
      </article>

      {emptyGroups.length ? (
        <details className="fold-panel">
          <summary className="fold-panel-summary">
            <span className="fold-panel-heading">
              <span className="fold-panel-heading-copy">
                <span className="eyebrow">No cleans booked</span>
                <span className="fold-panel-title">Quiet days</span>
              </span>
              <span className="fold-panel-heading-meta">
                <span className="fold-panel-count">{emptyGroups.length}</span>
                <span className="fold-panel-chevron" aria-hidden="true" />
              </span>
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {emptyGroups.map(({ group }) => (
              <DayCard
                key={group.date}
                group={group}
                open={openDay === group.date}
                onToggle={() => onToggleDay(group.date)}
                onAddJob={onAddJob}
              />
            ))}
          </div>
        </details>
      ) : null}
    </>
  )
}
