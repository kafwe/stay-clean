import { createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { PwaClient } from '#/components/PwaClient'
import { SetupWorkspace } from '#/components/SetupWorkspace'
import { WeekPanelHeader } from '#/components/WeekSections'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/setup')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: SetupRoute,
})

function SetupRoute() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      <AuthView
        password={password}
        setPassword={setPassword}
        busy={busyKey === 'login'}
        error={error}
        title="Open the support tools"
        body="Sign in to turn on phone reminders, share the week, or update homes and cleaners."
        onSubmit={() => {
          void runAction('login', async () => {
            await postJson('/api/auth/login', { password })
          })
        }}
      />
    )
  }

  return (
    <MobileAppShell activeTab="more" weekStart={data.weekStart}>
      <WeekPanelHeader
        eyebrow="Support tools"
        title="More"
        status={data.weekStatus}
        showStatus={false}
        showWeekControls={false}
        showThisWeekButton={false}
        onPrevious={() => {}}
        onCurrent={() => {}}
        onNext={() => {}}
      >
        <article className="overview-card">
          <div className="overview-copy">
            <p className="eyebrow">Support tools</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">
              Use these only when needed
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              The weekly plan stays in the main view. This screen is for reminders, sharing, and setup.
            </p>
          </div>
        </article>
      </WeekPanelHeader>

      <section className="content-stack">
        <article className="ledger-panel rounded-[1.75rem] p-5">
          <p className="eyebrow">Common tasks</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Quick tools</h2>
          <div className="mt-5 space-y-3">
            <div className="detail-card items-start">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-strong)]">Phone reminders</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  Get a reminder when the new week is ready or when bookings change.
                </p>
              </div>
              <PwaClient authenticated={data.authenticated} vapidPublicKey={data.vapidPublicKey} />
            </div>

            <div className="detail-card items-start">
              <div>
                <p className="text-sm font-semibold text-[var(--accent-deep)]">Sign out of this device</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  This will end the current manager session and require the password again.
                </p>
              </div>
              <button
                type="button"
                className="action-danger"
                disabled={busyKey === 'logout'}
                onClick={() =>
                  runAction('logout', async () => {
                    await postJson('/api/auth/logout')
                  })
                }
              >
                {busyKey === 'logout' ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </article>

        <SetupWorkspace
          apartments={data.apartments}
          distanceMatrixPairs={data.distanceMatrixPairs}
          apartmentsMissingCoordinates={data.apartmentsMissingCoordinates}
          busyKey={busyKey}
          error={error}
          setBusyKey={setBusyKey}
          setError={setError}
          onDone={refresh}
        />
      </section>
    </MobileAppShell>
  )
}
