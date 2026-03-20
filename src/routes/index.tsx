import { AlertCircle, BellDot, CalendarRange, RefreshCcw, Sparkles } from 'lucide-react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { startTransition, useEffect, useState } from 'react'
import { PwaClient } from '#/components/PwaClient'
import { PdfExportButton } from '#/components/PdfExportButton'
import { getDashboardSnapshot } from '#/lib/dashboard'
import { formatDayLabel } from '#/lib/date'
import type { ChangeSet } from '#/lib/types'

const loadDashboard = createServerFn({ method: 'GET' }).handler(() => getDashboardSnapshot())

export const Route = createFileRoute('/')({
  loader: () => loadDashboard(),
  component: App,
})

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error ?? 'Request failed')
  }
}

function App() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(
    data.dayGroups.find((group) => !group.isEmpty)?.date ?? data.weekStart,
  )
  const [password, setPassword] = useState('')
  const [chatMessage, setChatMessage] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const nextDate = data.dayGroups.find((group) => !group.isEmpty)?.date ?? data.weekStart
    setSelectedDate(nextDate)
  }, [data.dayGroups, data.weekStart])

  async function refresh() {
    startTransition(() => {
      router.invalidate()
    })
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key)
    setError(null)

    try {
      await action()
      await refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong')
    } finally {
      setBusyKey(null)
    }
  }

  if (!data.authenticated) {
    return (
      <main className="page-wrap px-4 py-8 sm:py-12">
        <section className="ledger-panel grid gap-10 overflow-hidden rounded-[2rem] px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="eyebrow">Private housekeeping control</p>
            <h1 className="display-title max-w-2xl text-5xl leading-[0.96] text-[var(--ink-strong)] sm:text-7xl">
              Weekly cleaning control for the current week, not another spreadsheet.
            </h1>
            <p className="max-w-xl text-base leading-8 text-[var(--ink-soft)] sm:text-lg">
              StayClean drafts the week, watches iCal changes, flags long stays,
              and waits for your approval before anything touches a confirmed schedule.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['iCal every 4h', 'Booking changes create suggested schedule patches.'],
                ['PWA push alerts', 'Sunday drafts and same-week impacts come back to your phone.'],
                ['Chat with approval', 'Natural language edits stay proposed until you accept them.'],
              ].map(([title, copy]) => (
                <article key={title} className="mini-card">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
                    {title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{copy}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="paper-stack rounded-[1.75rem] p-5 sm:p-7">
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_24px_60px_rgba(83,65,40,0.08)]">
              <p className="eyebrow">Manager sign-in</p>
              <h2 className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">
                Open the control room
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                A single password keeps this internal while we keep the setup light.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void runAction('login', async () => {
                    await postJson('/api/auth/login', { password })
                  })
                }}
              >
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">
                    Password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="field"
                    placeholder="Enter the manager password"
                  />
                </label>
                <button type="submit" className="action-primary w-full" disabled={busyKey === 'login'}>
                  {busyKey === 'login' ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              {error ? (
                <p className="mt-4 rounded-2xl border border-[rgba(140,92,53,0.16)] bg-[rgba(190,143,97,0.08)] px-4 py-3 text-sm text-[var(--accent-deep)]">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    )
  }

  const selectedDay =
    data.dayGroups.find((group) => group.date === selectedDate) ?? data.dayGroups[0]

  return (
    <main className="page-wrap px-4 pb-14 pt-5 sm:pt-8">
      <section className="hero-panel overflow-hidden rounded-[2.2rem] px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">StayClean weekly board</p>
            <h1 className="display-title mt-3 text-4xl leading-[0.95] text-[var(--ink-strong)] sm:text-6xl">
              {data.weekLabel}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--ink-soft)] sm:text-lg">
              Draft the week, watch iCal changes, review suggested patches, and
              export the final schedule without leaving the PWA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="status-pill">
              <CalendarRange size={16} />
              {data.weekStatus ?? 'setup'}
            </span>
            <span className="status-pill subtle">
              <BellDot size={16} />
              {data.syncSummary}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="action-primary"
            disabled={busyKey === 'sync'}
            onClick={() =>
              runAction('sync', async () => {
                await postJson('/api/system/run-sync')
              })
            }
          >
            <RefreshCcw size={16} />
            {busyKey === 'sync' ? 'Checking iCal...' : 'Check iCal now'}
          </button>
          <button
            type="button"
            className="action-secondary"
            disabled={busyKey === 'confirm'}
            onClick={() =>
              runAction('confirm', async () => {
                await postJson('/api/schedule/confirm')
              })
            }
          >
            Confirm current week
          </button>
          <PdfExportButton
            weekLabel={data.weekLabel}
            weekStatus={data.weekStatus}
            dayGroups={data.dayGroups}
          />
          <button
            type="button"
            className="action-ghost"
            onClick={() =>
              runAction('logout', async () => {
                await postJson('/api/auth/logout')
              })
            }
          >
            Sign out
          </button>
        </div>

        <div className="mt-5">
          <PwaClient authenticated={data.authenticated} vapidPublicKey={data.vapidPublicKey} />
        </div>
      </section>

      {error ? (
        <section className="mt-4 rounded-[1.5rem] border border-[rgba(140,92,53,0.16)] bg-[rgba(190,143,97,0.08)] px-5 py-4 text-sm text-[var(--accent-deep)]">
          {error}
        </section>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <article className="ledger-panel rounded-[2rem] p-4 sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Current week</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                Schedule grid
              </h2>
            </div>
            <p className="text-sm text-[var(--ink-soft)]">
              Designed to stay close to your current PDF structure.
            </p>
          </div>

          {data.emptyStateReason ? (
            <div className="empty-state mt-6">
              <AlertCircle size={18} />
              <span>{data.emptyStateReason}</span>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[var(--line)]">
              <div className="schedule-head">
                <span>Date</span>
                <span>Apartment</span>
                <span>Cleaner</span>
              </div>

              {data.dayGroups.map((group) => (
                <button
                  key={group.date}
                  type="button"
                  className={`schedule-group ${selectedDate === group.date ? 'is-active' : ''}`}
                  onClick={() => setSelectedDate(group.date)}
                >
                  {group.rows.length === 0 ? (
                    <div className="schedule-row">
                      <div className="schedule-day">{group.label}</div>
                      <div className="schedule-apartment">No cleaning scheduled</div>
                      <div className="schedule-cleaner">-</div>
                    </div>
                  ) : (
                    group.rows.map((row, rowIndex) => (
                      <div key={row.id} className="schedule-row">
                        <div className="schedule-day">{rowIndex === 0 ? group.label : ''}</div>
                        <div className="schedule-apartment">
                          <strong>{row.apartmentName}</strong>
                          <span>{row.notes ?? row.taskType.replace('_', ' ')}</span>
                        </div>
                        <div className="schedule-cleaner">{row.cleanerName ?? 'Unassigned'}</div>
                      </div>
                    ))
                  )}
                </button>
              ))}
            </div>
          )}
        </article>

        <div className="space-y-6">
          <article className="ledger-panel rounded-[2rem] p-5">
            <p className="eyebrow">Day view</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
              {selectedDay ? formatDayLabel(selectedDay.date) : 'Choose a day'}
            </h2>
            <div className="mt-5 space-y-3">
              {selectedDay?.rows.length ? (
                selectedDay.rows.map((row) => (
                  <div key={row.id} className="detail-card">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ink-strong)]">
                        {row.apartmentName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-soft)]">
                        {row.notes ?? 'Scheduled clean'}
                      </p>
                    </div>
                    <div className="cleaner-chip">{row.cleanerName ?? 'Unassigned'}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-[var(--ink-soft)]">
                  Nothing is booked for this day yet.
                </p>
              )}
            </div>
          </article>

          <ChangeQueue
            changeSets={data.changeSets}
            busyKey={busyKey}
            onApprove={(changeSetId) =>
              runAction(`approve-${changeSetId}`, async () => {
                await postJson(`/api/suggestions/${changeSetId}/approve`)
              })
            }
            onReject={(changeSetId) =>
              runAction(`reject-${changeSetId}`, async () => {
                await postJson(`/api/suggestions/${changeSetId}/reject`)
              })
            }
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr_0.9fr]">
        <article className="ledger-panel rounded-[2rem] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Chat assistant</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                Propose changes in plain language
              </h2>
            </div>
            <Sparkles className="text-[var(--accent)]" size={20} />
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Example: “Give Sis Nolu Monday off and move her cleans to Lovey.”
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void runAction('chat', async () => {
                await postJson('/api/chat/propose', { message: chatMessage })
                setChatMessage('')
              })
            }}
          >
            <textarea
              value={chatMessage}
              onChange={(event) => setChatMessage(event.target.value)}
              rows={5}
              className="field min-h-32"
              placeholder="Describe the change you want. The assistant will create a suggested patch for approval."
            />
            <button type="submit" className="action-primary" disabled={busyKey === 'chat'}>
              {busyKey === 'chat' ? 'Building suggestion...' : 'Create suggested change'}
            </button>
          </form>
        </article>

        <article className="ledger-panel rounded-[2rem] p-5">
          <p className="eyebrow">Manual review</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
            Long stays flagged
          </h2>
          <div className="mt-5 space-y-3">
            {data.manualReviews.length ? (
              data.manualReviews.map((item) => (
                <div key={item.id} className="detail-card items-start">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-strong)]">
                      {item.apartmentName}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {item.checkIn} to {item.checkOut} • {item.nights} nights
                    </p>
                  </div>
                  <span className="cleaner-chip warning">{item.note}</span>
                </div>
              ))
            ) : (
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                No long stays need manual attention for the current week.
              </p>
            )}
          </div>
        </article>

        <SetupPanel busyKey={busyKey} onAction={runAction} apartments={data.apartments} />
      </section>
    </main>
  )
}

function ChangeQueue({
  changeSets,
  busyKey,
  onApprove,
  onReject,
}: {
  changeSets: ChangeSet[]
  busyKey: string | null
  onApprove: (changeSetId: string) => Promise<void>
  onReject: (changeSetId: string) => Promise<void>
}) {
  return (
    <article className="ledger-panel rounded-[2rem] p-5">
      <p className="eyebrow">Suggested changes</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
        Pending approval
      </h2>

      <div className="mt-5 space-y-4">
        {changeSets.length ? (
          changeSets.map((changeSet) => (
            <div key={changeSet.id} className="change-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[var(--ink-strong)]">
                    {changeSet.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{changeSet.summary}</p>
                </div>
                <span className="status-pill subtle">{changeSet.source}</span>
              </div>

              <div className="mt-4 space-y-2">
                {changeSet.payload.changes.map((change) => (
                  <div key={`${change.date}-${change.apartmentName}`} className="change-row">
                    <span>
                      {change.date} • {change.apartmentName}
                    </span>
                    <span>
                      {change.beforeCleaner ?? '-'} → {change.afterCleaner ?? '-'}
                    </span>
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
                  {busyKey === `approve-${changeSet.id}` ? 'Approving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  disabled={busyKey === `reject-${changeSet.id}`}
                  onClick={() => {
                    void onReject(changeSet.id)
                  }}
                >
                  {busyKey === `reject-${changeSet.id}` ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            No pending review items. When iCal changes affect this week or chat proposes a patch,
            it will appear here.
          </p>
        )}
      </div>
    </article>
  )
}

function SetupPanel({
  busyKey,
  onAction,
  apartments,
}: {
  busyKey: string | null
  onAction: (key: string, action: () => Promise<void>) => Promise<void>
  apartments: Array<{ id: string; name: string }>
}) {
  const [apartmentName, setApartmentName] = useState('')
  const [buildingId, setBuildingId] = useState('')
  const [address, setAddress] = useState('')
  const [icalUrl, setIcalUrl] = useState('')
  const [cleanerName, setCleanerName] = useState('')
  const [manualLabel, setManualLabel] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualApartmentId, setManualApartmentId] = useState('')

  return (
    <article className="ledger-panel rounded-[2rem] p-5">
      <p className="eyebrow">Setup</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
        Add the real-world inputs
      </h2>

      <div className="mt-5 space-y-5">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void onAction('add-apartment', async () => {
              await postJson('/api/setup/apartments', {
                name: apartmentName,
                buildingId,
                address,
                icalUrl,
              })
              setApartmentName('')
              setBuildingId('')
              setAddress('')
              setIcalUrl('')
            })
          }}
        >
          <h3 className="section-title">Apartment</h3>
          <input
            className="field"
            placeholder="Apartment name"
            value={apartmentName}
            onChange={(event) => setApartmentName(event.target.value)}
          />
          <input
            className="field"
            placeholder="Building ID"
            value={buildingId}
            onChange={(event) => setBuildingId(event.target.value)}
          />
          <input
            className="field"
            placeholder="Address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <input
            className="field"
            placeholder="iCal URL (optional for now)"
            value={icalUrl}
            onChange={(event) => setIcalUrl(event.target.value)}
          />
          <button type="submit" className="action-secondary" disabled={busyKey === 'add-apartment'}>
            {busyKey === 'add-apartment' ? 'Saving...' : 'Add apartment'}
          </button>
        </form>

        <form
          className="space-y-3 border-t border-[var(--line)] pt-5"
          onSubmit={(event) => {
            event.preventDefault()
            void onAction('add-cleaner', async () => {
              await postJson('/api/setup/cleaners', {
                name: cleanerName,
              })
              setCleanerName('')
            })
          }}
        >
          <h3 className="section-title">Cleaner</h3>
          <input
            className="field"
            placeholder="Cleaner name"
            value={cleanerName}
            onChange={(event) => setCleanerName(event.target.value)}
          />
          <button type="submit" className="action-secondary" disabled={busyKey === 'add-cleaner'}>
            {busyKey === 'add-cleaner' ? 'Saving...' : 'Add cleaner'}
          </button>
        </form>

        <form
          className="space-y-3 border-t border-[var(--line)] pt-5"
          onSubmit={(event) => {
            event.preventDefault()
            void onAction('add-manual', async () => {
              await postJson('/api/setup/manual-cleans', {
                label: manualLabel,
                taskDate: manualDate,
                apartmentId: manualApartmentId || undefined,
                isRecurring: false,
              })
              setManualLabel('')
              setManualDate('')
              setManualApartmentId('')
            })
          }}
        >
          <h3 className="section-title">External clean</h3>
          <input
            className="field"
            placeholder="Label or client name"
            value={manualLabel}
            onChange={(event) => setManualLabel(event.target.value)}
          />
          <input
            type="date"
            className="field"
            value={manualDate}
            onChange={(event) => setManualDate(event.target.value)}
          />
          <select
            className="field"
            value={manualApartmentId}
            onChange={(event) => setManualApartmentId(event.target.value)}
          >
            <option value="">No linked apartment</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {apartment.name}
              </option>
            ))}
          </select>
          <button type="submit" className="action-secondary" disabled={busyKey === 'add-manual'}>
            {busyKey === 'add-manual' ? 'Saving...' : 'Add external clean'}
          </button>
        </form>
      </div>
    </article>
  )
}
