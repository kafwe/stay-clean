import { format, parseISO } from 'date-fns'
import { formatDayLabel, weekDates } from '#/lib/date'
import type { Cleaner, CleanerAvailability, CleanerWeekAvailability } from '#/lib/types'
import { getAvailabilityPresentation } from '../week-model'

export function CleanerAvailabilitySheet({
  open,
  cleaners,
  weekStart,
  weekAvailability,
  weekCleanerAvailability,
  weekLabel,
  busyKey,
  successMessage,
  onClose,
  onSetAvailability,
}: {
  open: boolean
  cleaners: Cleaner[]
  weekStart: string
  weekAvailability: CleanerAvailability[]
  weekCleanerAvailability: CleanerWeekAvailability[]
  weekLabel: string
  busyKey: string | null
  successMessage: string | null
  onClose: () => void
  onSetAvailability: (cleanerId: string, isAvailable: boolean, date?: string) => void
}) {
  if (!open) {
    return null
  }

  const weekDateList = weekDates(weekStart)
  const availabilityBusy = Boolean(busyKey?.startsWith('availability-'))
  const availabilityByCleanerId = new Map(
    weekCleanerAvailability.map((item) => [item.cleanerId, item.status]),
  )
  const offDatesByCleanerId = new Map<string, Set<string>>()

  for (const entry of weekAvailability) {
    if (entry.status !== 'off') {
      continue
    }

    const offDateSet = offDatesByCleanerId.get(entry.cleanerId) ?? new Set<string>()
    offDateSet.add(entry.date)
    offDatesByCleanerId.set(entry.cleanerId, offDateSet)
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Team availability">
      <div className="sheet-panel sheet-panel-feature">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Team schedule</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Availability</h2>
          </div>
          <button type="button" className="action-ghost sheet-close-button" onClick={onClose} disabled={availabilityBusy}>
            Close
          </button>
        </div>

        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">Set who can take cleans in {weekLabel}.</p>
        <section
          className={`inline-feedback inline-feedback-success${successMessage ? '' : ' is-empty'}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {successMessage ?? '\u00A0'}
        </section>

        <div className="mt-5 space-y-3">
          {cleaners.length ? (
            cleaners.map((cleaner) => {
              const availabilityStatus = availabilityByCleanerId.get(cleaner.id) ?? 'available'
              const availabilityMeta = getAvailabilityPresentation(availabilityStatus)
              const availableKey = `availability-on-${cleaner.id}-week`
              const offKey = `availability-off-${cleaner.id}-week`
              const isSavingAvailable = busyKey === availableKey
              const isSavingOff = busyKey === offKey
              const offDates = offDatesByCleanerId.get(cleaner.id) ?? new Set<string>()

              return (
                <article
                  key={cleaner.id}
                  className={`home-card availability-card ${
                    availabilityMeta.tone === 'off'
                      ? 'is-off'
                      : availabilityMeta.tone === 'partial'
                        ? 'is-partial'
                        : ''
                  }`}
                >
                  <div className="availability-copy">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="cleaner-chip">
                        <span
                          className="cleaner-dot"
                          style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                          aria-hidden="true"
                        />
                        {cleaner.name}
                      </span>
                      <span
                        className={`availability-inline-status availability-inline-status-${availabilityMeta.tone}`}
                        title={availabilityMeta.tooltip}
                      >
                        {availabilityMeta.shortLabel}
                      </span>
                    </div>
                    <p className="availability-summary">{availabilityMeta.summary}</p>
                    <div className="availability-day-grid" role="group" aria-label={`${cleaner.name} availability by day`}>
                      {weekDateList.map((dateIso) => {
                        const isAvailableForDay = !offDates.has(dateIso)
                        const isSavingDay =
                          busyKey === `availability-off-${cleaner.id}-${dateIso}` ||
                          busyKey === `availability-on-${cleaner.id}-${dateIso}`

                        return (
                          <button
                            key={dateIso}
                            type="button"
                            className={`availability-day-toggle ${isAvailableForDay ? 'is-on' : 'is-off'}`}
                            disabled={availabilityBusy && !isSavingDay}
                            aria-pressed={!isAvailableForDay}
                            title={`${cleaner.name}: ${isAvailableForDay ? 'available' : 'off'} on ${formatDayLabel(dateIso)}`}
                            onClick={() => {
                              onSetAvailability(cleaner.id, !isAvailableForDay, dateIso)
                            }}
                          >
                            <span className="availability-day-name">{format(parseISO(dateIso), 'EEE')}</span>
                            <span className="availability-day-date">{format(parseISO(dateIso), 'd MMM')}</span>
                            <span className="availability-day-state">
                              {isSavingDay ? '...' : isAvailableForDay ? 'On' : 'Off'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="availability-actions">
                    <button
                      type="button"
                      className={`availability-toggle ${availabilityStatus === 'available' ? 'is-active is-active-on' : ''}`}
                      disabled={availabilityBusy && !isSavingAvailable}
                      onClick={() => {
                        if (availabilityStatus === 'available') {
                          return
                        }

                        onSetAvailability(cleaner.id, true)
                      }}
                    >
                      {isSavingAvailable ? 'Saving...' : 'Available all week'}
                    </button>
                    <button
                      type="button"
                      className={`availability-toggle ${availabilityStatus === 'off' ? 'is-active is-active-off' : ''}`}
                      disabled={availabilityBusy && !isSavingOff}
                      onClick={() => {
                        if (availabilityStatus === 'off') {
                          return
                        }

                        onSetAvailability(cleaner.id, false)
                      }}
                    >
                      {isSavingOff ? 'Saving...' : 'Off all week'}
                    </button>
                  </div>
                </article>
              )
            })
          ) : (
            <p className="text-sm leading-6 text-[var(--ink-soft)]">Add a cleaner to start setting availability for {weekLabel}.</p>
          )}
        </div>
      </div>
    </div>
  )
}
