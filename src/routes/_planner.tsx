import { Link, Outlet, createFileRoute, retainSearchParams, useLocation, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'

function getPlannerAuthCopy(pathname: string) {
  if (pathname.startsWith('/setup')) {
    return {
      title: 'Open manager tools',
      body: 'Sign in to manage homes, cleaners, and phone reminders.',
    }
  }

  if (pathname.startsWith('/review')) {
    return {
      title: 'Open the review queue',
      body: 'Sign in to review booking changes and long stays before confirming the week.',
    }
  }

  return {
    title: 'Open the weekly planner',
    body: "Sign in to review and share this week's cleaning plan.",
  }
}

export const Route = createFileRoute('/_planner')({
  validateSearch: weekSearchSchema,
  search: {
    middlewares: [retainSearchParams(['week'])],
  },
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  pendingMs: 300,
  pendingComponent: PlannerPendingState,
  errorComponent: PlannerErrorState,
  component: PlannerGuardBoundary,
})

function PlannerGuardBoundary() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const { pathname } = useLocation()
  const authCopy = getPlannerAuthCopy(pathname)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn(password: string) {
    setBusy(true)
    setError(null)

    try {
      await postJson('/api/auth/login', { password })
      await router.invalidate({ sync: true })
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!data.authenticated) {
    return (
      <AuthView
        busy={busy}
        error={error}
        title={authCopy.title}
        body={authCopy.body}
        onSubmit={(password) => {
          void signIn(password)
        }}
      />
    )
  }

  return <Outlet />
}

function PlannerPendingState() {
  return (
    <main className="page-wrap px-4 py-8 sm:py-12">
      <section className="ledger-panel rounded-[2rem] px-6 py-8 sm:px-10 sm:py-12">
        <p className="eyebrow">Loading planner</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ink-strong)] sm:text-4xl">Getting this week ready</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--ink-soft)]">
          Pulling bookings, cleaners, and review items for the selected week.
        </p>
      </section>
    </main>
  )
}

function PlannerErrorState({ error }: { error: unknown }) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : 'This planner screen could not be loaded.'

  return (
    <main className="page-wrap px-4 py-8 sm:py-12">
      <section className="ledger-panel rounded-[2rem] px-6 py-8 sm:px-10 sm:py-12">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ink-strong)] sm:text-4xl">Unable to load this planner view</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--ink-soft)]">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="action-primary"
            onClick={() => {
              void router.invalidate()
            }}
          >
            Try again
          </button>
          <Link to="/" className="action-secondary no-underline">
            Go to week view
          </Link>
        </div>
      </section>
    </main>
  )
}