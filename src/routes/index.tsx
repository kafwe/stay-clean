import { CalendarCheck2, RefreshCcw } from 'lucide-react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { DayCard, WeekPanelHeader } from '#/components/WeekSections'
import { getTodayIsoInTimezone, isoInWeek, shiftWeek } from '#/lib/date'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: App,
})

function App() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const todayIso = getTodayIsoInTimezone()
  const isCurrentWeek = isoInWeek(todayIso, data.weekStart)
  const todayIndex = isCurrentWeek
    ? data.dayGroups.findIndex((group) => group.date === todayIso)
    : -1

  const upcomingGroups = todayIndex >= 0 ? data.dayGroups.slice(todayIndex) : data.dayGroups
  const earlierGroups = todayIndex > 0 ? data.dayGroups.slice(0, todayIndex) : []
  const focusGroups = upcomingGroups.length ? upcomingGroups : data.dayGroups
  const jobsLeft = focusGroups.reduce((total, group) => total + group.rows.length, 0)

  useEffect(() => {
    const firstBusyDay =
      focusGroups.find((group) => !group.isEmpty)?.date ??
      earlierGroups.find((group) => !group.isEmpty)?.date ??
      data.weekStart
    setOpenDay(firstBusyDay)
  }, [data.weekStart, earlierGroups, focusGroups])

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

  function moveWeek(direction: -1 | 1) {
    startTransition(() => {
      void router.navigate({
        to: '/',
        search: () => ({
          week: shiftWeek(data.weekStart, direction),
        }),
      })
    })
  }

  function jumpToCurrentWeek() {
    startTransition(() => {
      void router.navigate({
        to: '/',
        search: () => ({}),
      })
    })
  }

  if (!data.authenticated) {
    return (
      <AuthView
        password={password}
        setPassword={setPassword}
        busy={busyKey === 'login'}
        error={error}
        onSubmit={() => {
          void runAction('login', async () => {
            await postJson('/api/auth/login', { password })
          })
        }}
      />
    )
  }

  return (
    <MobileAppShell activeTab="week" weekStart={data.weekStart}>
      <WeekPanelHeader
        title={data.weekLabel}
        status={data.weekStatus}
        summaryItems={[
          `${jobsLeft} ${jobsLeft === 1 ? 'job' : 'jobs'} left`,
          `${data.changeSets.length} ${data.changeSets.length === 1 ? 'change' : 'changes'} waiting`,
        ]}
        showThisWeekButton={Boolean(search.week)}
        onPrevious={() => moveWeek(-1)}
        onCurrent={jumpToCurrentWeek}
        onNext={() => moveWeek(1)}
      >
        <div className="compact-actions">
          <button
            type="button"
            className="action-primary flex-1"
            disabled={busyKey === 'sync'}
            onClick={() =>
              runAction('sync', async () => {
                await postJson('/api/system/run-sync', { weekStart: data.weekStart })
              })
            }
          >
            <RefreshCcw size={16} />
            {busyKey === 'sync' ? 'Checking...' : 'Check for updates'}
          </button>
          <button
            type="button"
            className="action-secondary flex-1"
            disabled={busyKey === 'confirm' || data.weekStatus === 'confirmed'}
            onClick={() =>
              runAction('confirm', async () => {
                await postJson('/api/schedule/confirm', { weekStart: data.weekStart })
              })
            }
          >
            <CalendarCheck2 size={16} />
            {data.weekStatus === 'confirmed'
              ? 'Week locked in'
              : busyKey === 'confirm'
                ? 'Saving...'
                : 'Lock in this week'}
          </button>
        </div>

        {data.changeSets.length || data.manualReviews.length ? (
          <Link to="/review" search={{ week: data.weekStart }} className="review-callout no-underline">
            <div>
              <p className="eyebrow">Needs your attention</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Review suggested changes and long stays before sharing the week.
              </p>
            </div>
            <span className="cleaner-chip">Open changes</span>
          </Link>
        ) : null}
      </WeekPanelHeader>

      {error ? (
        <section className="error-banner">
          {error}
        </section>
      ) : null}

      <section className="content-stack">
        <article className="ledger-panel rounded-[1.75rem] p-4">
          <div className="section-head">
            <div>
              <p className="eyebrow">{isCurrentWeek ? 'From today' : 'This week'}</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                Weekly plan
              </h2>
            </div>
            <p className="section-copy">
              Tap a day to see the homes and who is doing each clean.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {focusGroups.map((group) => (
              <DayCard
                key={group.date}
                group={group}
                open={openDay === group.date}
                isToday={group.date === todayIso}
                onToggle={() => setOpenDay(openDay === group.date ? null : group.date)}
              />
            ))}
          </div>
        </article>

        {earlierGroups.length ? (
          <details className="fold-panel">
            <summary>Earlier this week</summary>
            <div className="mt-4 space-y-3">
              {earlierGroups.map((group) => (
                <DayCard
                  key={group.date}
                  group={group}
                  open={openDay === group.date}
                  onToggle={() => setOpenDay(openDay === group.date ? null : group.date)}
                />
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </MobileAppShell>
  )
}
