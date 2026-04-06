import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
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
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingReviewCount = data.changeSets.length + data.manualReviews.length

  async function refresh() {
    await router.invalidate({ sync: true })
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key)
    setError(null)

    try {
      await action()
      await refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  async function signOut() {
    setBusyKey('logout')
    setError(null)

    try {
      await postJson('/api/auth/logout')

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => null)
        registration?.active?.postMessage({ type: 'CLEAR_DYNAMIC_CACHES' })
      }

      // Force a full navigation so the next screen is rendered with the cleared auth cookie.
      window.location.replace('/')
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong. Please try again.')
      setBusyKey(null)
    }
  }

  if (!data.authenticated) {
    return (
      <AuthView
        busy={busyKey === 'login'}
        error={error}
        title="Open manager tools"
        body="Sign in to manage homes, cleaners, and phone reminders."
        onSubmit={(password) => {
          void runAction('login', async () => {
            await postJson('/api/auth/login', { password })
          })
        }}
      />
    )
  }

  return (
    <MobileAppShell activeTab="more" weekStart={data.weekStart} pendingReviewCount={pendingReviewCount}>
      <div className="route-stage route-stage-setup">
      <WeekPanelHeader
        eyebrow="Tools"
        title="More"
        status={data.weekStatus}
        showStatus={false}
        showWeekControls={false}
        showThisWeekButton={false}
        onPrevious={() => {}}
        onCurrent={() => {}}
        onNext={() => {}}
      >
        <article className="overview-card overview-card-setup">
          <div className="overview-copy">
            <p className="eyebrow">Manager tools</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--ink-strong)]">Setup and account</h2>
            <p className="support-overview-copy">
              Use this area for occasional setup tasks.
            </p>
          </div>
        </article>
      </WeekPanelHeader>

      <section className="content-stack route-stack route-stack-setup">
        <article className="ledger-panel rounded-[1.75rem] p-5 panel-soft">
          <p className="eyebrow">Common tasks</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Quick tools</h2>
          <div className="mt-5 space-y-3">
            <div className="detail-card items-start">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-strong)]">Phone reminders</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  Turn on reminders for this manager phone.
                </p>
              </div>
              <PwaClient authenticated={data.authenticated} vapidPublicKey={data.vapidPublicKey} />
            </div>

            <div className="detail-card items-start">
              <div>
                <p className="text-sm font-semibold text-[var(--accent-deep)]">Sign out of this device</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">
                  End this manager session on this device.
                </p>
              </div>
              <button
                type="button"
                className="action-danger"
                disabled={busyKey === 'logout'}
                onClick={() => {
                  void signOut()
                }}
              >
                {busyKey === 'logout' ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </article>

        <SetupWorkspace
          apartments={data.apartments ?? []}
          cleaners={data.cleaners ?? []}
          busyKey={busyKey}
          error={error}
          setBusyKey={setBusyKey}
          setError={setError}
          onDone={refresh}
        />
      </section>
      </div>
    </MobileAppShell>
  )
}
