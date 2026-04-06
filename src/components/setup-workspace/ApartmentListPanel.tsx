import type { Apartment } from '#/lib/types'

export function ApartmentListPanel({
  apartments,
  active,
  busyKey,
  onToggle,
  onDeleteApartment,
}: {
  apartments: Apartment[]
  active: boolean
  busyKey: string | null
  onToggle: () => void
  onDeleteApartment: (apartment: Apartment) => void
}) {
  return (
    <article className="fold-panel setup-summary-panel">
      <div className="setup-summary-head">
        <div>
          <p className="section-title">Homes in the plan</p>
          <p className="setup-summary-copy">Keep your active homes up to date.</p>
        </div>
        <button type="button" className={active ? 'action-ghost' : 'action-secondary'} onClick={onToggle}>
          {active ? 'Hide form' : 'Add a home'}
        </button>
      </div>

      {apartments.length ? (
        <div className="home-list-grid setup-summary-list">
          {apartments.map((apartment) => {
            const deleteKey = `delete-apartment-${apartment.id}`
            const isDeleting = busyKey === deleteKey

            return (
              <article key={apartment.id} className="home-card">
                <div>
                  <p className="home-card-name">{apartment.colloquialName ?? apartment.name}</p>
                  <p className="home-card-address">{apartment.address}</p>
                  {apartment.bookingIcalUrl || apartment.airbnbIcalUrl ? (
                    <div className="space-y-1">
                      {apartment.bookingIcalUrl ? (
                        <a
                          href={apartment.bookingIcalUrl}
                          className="home-card-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Booking.com iCal
                        </a>
                      ) : null}
                      {apartment.airbnbIcalUrl ? (
                        <a
                          href={apartment.airbnbIcalUrl}
                          className="home-card-link"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Airbnb iCal
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <p className="home-card-muted">No booking feeds yet</p>
                  )}
                </div>
                <button
                  type="button"
                  className="action-ghost home-delete-button"
                  disabled={isDeleting}
                  onClick={() => onDeleteApartment(apartment)}
                >
                  {isDeleting ? 'Deleting...' : 'Delete home'}
                </button>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="text-sm leading-6 text-[var(--ink-soft)]">No homes added yet.</p>
      )}
    </article>
  )
}
