import { Users } from 'lucide-react'
import type { Cleaner, CleanerWeekAvailability } from '#/lib/types'
import { getAvailabilityPresentation } from '../week-model'

export function TeamAvailabilityCard({
  cleaners,
  weekCleanerAvailability,
  weekLabel,
  busy,
  onOpen,
}: {
  cleaners: Cleaner[]
  weekCleanerAvailability: CleanerWeekAvailability[]
  weekLabel: string
  busy: boolean
  onOpen: () => void
}) {
  return (
    <article className="ledger-panel rounded-[1.75rem] p-4 panel-soft">
      <div className="section-head">
        <div>
          <p className="eyebrow">Team for this week</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Cleaner availability</h2>
        </div>
        <p className="section-copy">Choose who is available in {weekLabel}.</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {cleaners.length ? (
          cleaners.map((cleaner) => {
            const availabilityStatus =
              weekCleanerAvailability.find((item) => item.cleanerId === cleaner.id)?.status ?? 'available'
            const availabilityMeta = getAvailabilityPresentation(availabilityStatus)

            return (
              <span
                key={cleaner.id}
                className={`cleaner-chip cleaner-chip-availability cleaner-chip-${availabilityMeta.tone}`}
                title={availabilityMeta.tooltip}
              >
                <span
                  className="cleaner-dot"
                  style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                  aria-hidden="true"
                />
                {cleaner.name}
                <span className={`availability-inline-status availability-inline-status-${availabilityMeta.tone}`}>
                  {availabilityMeta.shortLabel}
                </span>
              </span>
            )
          })
        ) : (
          <p className="text-sm leading-6 text-[var(--ink-soft)]">Add at least one cleaner to set weekly availability.</p>
        )}
      </div>

      <div className="mt-4">
        <button type="button" className="action-secondary" disabled={busy} onClick={onOpen}>
          <Users size={16} />
          {busy ? 'Saving...' : 'Team availability'}
        </button>
      </div>
    </article>
  )
}
