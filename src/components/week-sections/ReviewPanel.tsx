import { formatDayLabel } from '#/lib/date'
import type { ChangeSet } from '#/lib/types'

type Change = ChangeSet['payload']['changes'][number]

function getChangeReasonLabel(reason: Change['reason']) {
  if (reason === 'added') {
    return 'Added'
  }

  if (reason === 'removed') {
    return 'Removed'
  }

  return 'Reassigned'
}

function getChangeOutcomeLabel(change: Change) {
  if (change.reason === 'added') {
    return `New clean for ${change.afterCleaner ?? 'Unassigned'}`
  }

  if (change.reason === 'removed') {
    return `Remove ${change.beforeCleaner ?? 'Unassigned'} from this clean`
  }

  return `${change.beforeCleaner ?? 'Unassigned'} -> ${change.afterCleaner ?? 'Unassigned'}`
}

export function ReviewPanel({
  title,
  emptyCopy,
  changeSets,
  busyKey,
  onApprove,
  onReject,
}: {
  title: string
  emptyCopy: string
  changeSets: ChangeSet[]
  busyKey: string | null
  onApprove: (changeSetId: string) => Promise<void>
  onReject: (changeSetId: string) => Promise<void>
}) {
  return (
    <article className="ledger-panel rounded-[1.75rem] p-5">
      <p className="eyebrow">Pending review</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">{title}</h2>

      <div className="mt-5 space-y-4">
        {changeSets.length ? (
          changeSets.map((changeSet) => (
            <div key={changeSet.id} className="change-card">
              <div className="change-card-top">
                <h3 className="text-base font-semibold text-[var(--ink-strong)]">{changeSet.title}</h3>
                <span className="cleaner-chip subtle-chip">
                  {changeSet.payload.changes.length} {changeSet.payload.changes.length === 1 ? 'update' : 'updates'}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{changeSet.summary}</p>

              <div className="change-list">
                {changeSet.payload.changes.map((change) => (
                  <div key={`${change.date}-${change.apartmentName}`} className="change-row">
                    <div className="change-row-main">
                      <div className="change-row-meta">
                        <span className={`change-reason-pill is-${change.reason}`}>{getChangeReasonLabel(change.reason)}</span>
                        <span className="change-row-date">{formatDayLabel(change.date)}</span>
                      </div>
                      <p className="change-row-title">{change.apartmentName}</p>
                    </div>
                    <p className="change-row-outcome">{getChangeOutcomeLabel(change)}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="action-primary"
                  disabled={busyKey === `approve-${changeSet.id}`}
                  onClick={() => {
                    void onApprove(changeSet.id)
                  }}
                >
                  {busyKey === `approve-${changeSet.id}` ? 'Saving...' : 'Apply update'}
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  disabled={busyKey === `reject-${changeSet.id}`}
                  onClick={() => {
                    void onReject(changeSet.id)
                  }}
                >
                  {busyKey === `reject-${changeSet.id}` ? 'Saving...' : 'Keep as is'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-soft)]">{emptyCopy}</p>
        )}
      </div>
    </article>
  )
}
