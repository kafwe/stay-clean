import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { startTransition, useState } from 'react'
import { AuthView } from '#/components/AuthView'
import { MobileAppShell } from '#/components/MobileAppShell'
import { MessageComposer, WeekPanelHeader } from '#/components/WeekSections'
import { shiftWeek } from '#/lib/date'
import { loadDashboard, postJson, weekSearchSchema } from '#/lib/dashboard-page'

export const Route = createFileRoute('/message')({
  validateSearch: weekSearchSchema,
  loaderDeps: ({ search }) => ({ weekStart: search.week }),
  loader: ({ deps }) => loadDashboard({ data: { weekStart: deps.weekStart } }),
  component: MessageRoute,
})

function MessageRoute() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [chatMessage, setChatMessage] = useState('')
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

  function moveWeek(direction: -1 | 1) {
    startTransition(() => {
      void router.navigate({
        to: '/message',
        search: () => ({
          week: shiftWeek(data.weekStart, direction),
        }),
      })
    })
  }

  function jumpToCurrentWeek() {
    startTransition(() => {
      void router.navigate({
        to: '/message',
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
    <MobileAppShell activeTab={null} weekStart={data.weekStart}>
      <WeekPanelHeader
        eyebrow="Message about this week"
        title={data.weekLabel}
        status={data.weekStatus}
        summaryItems={[
          'Describe the change you want',
          'You review it before anything changes',
        ]}
        showThisWeekButton={Boolean(search.week)}
        onPrevious={() => moveWeek(-1)}
        onCurrent={jumpToCurrentWeek}
        onNext={() => moveWeek(1)}
      >
        <Link to="/" search={{ week: data.weekStart }} className="action-secondary no-underline">
          Back to the week
        </Link>
      </WeekPanelHeader>

      {error ? <section className="error-banner">{error}</section> : null}

      <section className="content-stack">
        <MessageComposer
          message={chatMessage}
          busy={busyKey === 'chat'}
          onChange={setChatMessage}
          onSubmit={() => {
            void runAction('chat', async () => {
              await postJson('/api/chat/propose', {
                message: chatMessage,
                weekStart: data.weekStart,
              })
              setChatMessage('')
              startTransition(() => {
                void router.navigate({
                  to: '/review',
                  search: () => ({ week: data.weekStart }),
                })
              })
            })
          }}
        />
      </section>
    </MobileAppShell>
  )
}
