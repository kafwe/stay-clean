import { CalendarCheck2, RefreshCcw } from 'lucide-react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useEffect, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PdfExportButton } from '#/components/PdfExportButton'
import { ChangeRequestSheet, DayCard, QuickEditSheet, WeekPanelHeader } from '#/components/WeekSections'
import { formatDayLabel, getTodayIsoInTimezone, isoInWeek, shiftWeek, weekDates } from '#/lib/date'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'
import type { ScheduleAssignment } from '#/lib/types'

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
  const [changeSheetOpen, setChangeSheetOpen] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [editingAssignment, setEditingAssignment] = useState<ScheduleAssignment | null>(null)
  const [editCleanerId, setEditCleanerId] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTaskDate, setEditTaskDate] = useState('')

  const todayIso = getTodayIsoInTimezone()
  const isCurrentWeek = isoInWeek(todayIso, data.weekStart)
  const changedDates = new Set(
    data.changeSets.flatMap((changeSet) => changeSet.payload.changes.map((change) => change.date)),
  )
  const reviewDates = new Set(data.manualReviews.map((item) => item.checkOut))

  const annotatedGroups = data.dayGroups.map((group) => {
    const badges: string[] = []
    let priority = 4
    let tone: 'default' | 'attention' | 'changed' = 'default'

    if (changedDates.has(group.date)) {
      badges.push('Changes waiting')
      priority = 0
      tone = 'changed'
    }

    if (reviewDates.has(group.date)) {
      badges.push('Review stay')
      priority = 0
      tone = 'changed'
    }

    if (isCurrentWeek && group.date < todayIso && group.rows.length > 0) {
      badges.push('Check this day')
      priority = Math.min(priority, 1)
      tone = tone === 'changed' ? 'changed' : 'attention'
    }

    if (group.date === todayIso) {
      priority = Math.min(priority, 2)
    }

    if (group.date > todayIso && group.rows.length > 0) {
      priority = Math.min(priority, 3)
    }

    if (group.rows.length === 0 && badges.length === 0) {
      priority = 5
    }

    return {
      group,
      badges,
      priority,
      tone,
    }
  })

  const activeGroups = annotatedGroups
    .filter((item) => item.group.rows.length > 0 || item.badges.length > 0)
    .sort((left, right) => {
      if (!isCurrentWeek) {
        return left.group.date.localeCompare(right.group.date)
      }

      if (left.priority === right.priority) {
        return left.group.date.localeCompare(right.group.date)
      }

      return left.priority - right.priority
    })

  const emptyGroups = annotatedGroups.filter(
    (item) => item.group.rows.length === 0 && item.badges.length === 0,
  )
  const jobsLeft = activeGroups.reduce((total, item) => total + item.group.rows.length, 0)
  const defaultOpenDay = activeGroups.find((item) => !item.group.isEmpty)?.group.date ?? data.weekStart

  useEffect(() => {
    setOpenDay(defaultOpenDay)
  }, [defaultOpenDay])

  useEffect(() => {
    if (!editingAssignment) {
      return
    }

    setEditCleanerId(editingAssignment.cleanerId ?? '')
    setEditNotes(editingAssignment.notes ?? '')
    setEditTaskDate(editingAssignment.taskDate)
  }, [editingAssignment])

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
    <MobileAppShell
      activeTab="week"
      weekStart={data.weekStart}
      onSwipeLeft={() => moveWeek(1)}
      onSwipeRight={() => moveWeek(-1)}
      floatingAction={
        <PdfExportButton
          weekLabel={data.weekLabel}
          weekStatus={data.weekStatus}
          dayGroups={data.dayGroups}
          variant="fab"
        />
      }
    >
      <WeekPanelHeader
        title={data.weekLabel}
        status={data.weekStatus}
        showThisWeekButton={Boolean(search.week)}
        onPrevious={() => moveWeek(-1)}
        onCurrent={jumpToCurrentWeek}
        onNext={() => moveWeek(1)}
      >
        <article className="overview-card">
          <div className="overview-copy">
            <p className="eyebrow">This week at a glance</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">
              {jobsLeft} {jobsLeft === 1 ? 'job' : 'jobs'} to run
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {data.changeSets.length
                ? `${data.changeSets.length} suggested ${data.changeSets.length === 1 ? 'change is' : 'changes are'} waiting for your approval.`
                : 'No suggested changes are waiting right now.'}
            </p>
          </div>

          <div className="overview-actions">
            <button
              type="button"
              className="action-primary"
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
              className="action-secondary"
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
            <button type="button" className="action-ghost" onClick={() => setChangeSheetOpen(true)}>
              Ask for a change
            </button>
          </div>
        </article>
      </WeekPanelHeader>

      {error ? (
        <section className="error-banner">
          {error}
        </section>
      ) : null}

      <section className="content-stack">
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

        <article className="ledger-panel rounded-[1.75rem] p-4">
          <div className="section-head">
            <div>
              <p className="eyebrow">Needs attention first</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">
                Weekly plan
              </h2>
            </div>
            <p className="section-copy">
              Overdue days, changed days, and today are shown before the rest of the week.
            </p>
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
                onToggle={() => setOpenDay(openDay === group.date ? null : group.date)}
                onRowSelect={(row) => setEditingAssignment(row)}
              />
            ))}
          </div>
        </article>

        {emptyGroups.length ? (
          <details className="fold-panel">
            <summary>Quiet days</summary>
            <div className="mt-4 space-y-3">
              {emptyGroups.map(({ group }) => (
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

      <QuickEditSheet
        open={Boolean(editingAssignment)}
        title={editingAssignment ? `${editingAssignment.apartmentName} · ${formatDayLabel(editingAssignment.taskDate)}` : ''}
        cleanerId={editCleanerId}
        notes={editNotes}
        taskDate={editTaskDate}
        cleaners={data.cleaners}
        dateOptions={weekDates(data.weekStart)}
        saving={busyKey === 'quick-edit'}
        onClose={() => setEditingAssignment(null)}
        onCleanerChange={setEditCleanerId}
        onNotesChange={setEditNotes}
        onTaskDateChange={setEditTaskDate}
        onSave={() => {
          if (!editingAssignment) {
            return
          }

          void runAction('quick-edit', async () => {
            await postJson('/api/schedule/manual-edit', {
              weekStart: data.weekStart,
              assignmentId: editingAssignment.id,
              cleanerId: editCleanerId || null,
              notes: editNotes,
              taskDate: editTaskDate,
            })
            setEditingAssignment(null)
          })
        }}
      />

      <ChangeRequestSheet
        open={changeSheetOpen}
        weekLabel={data.weekLabel}
        message={chatMessage}
        busy={busyKey === 'chat'}
        onChange={setChatMessage}
        onClose={() => {
          if (busyKey === 'chat') {
            return
          }

          setChangeSheetOpen(false)
        }}
        onSubmit={() => {
          void runAction('chat', async () => {
            await postJson('/api/chat/propose', {
              message: chatMessage,
              weekStart: data.weekStart,
            })
            setChatMessage('')
            setChangeSheetOpen(false)
            startTransition(() => {
              void router.navigate({
                to: '/review',
                search: () => ({ week: data.weekStart }),
              })
            })
          })
        }}
      />
    </MobileAppShell>
  )
}
