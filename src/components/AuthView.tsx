export function AuthView({
  password,
  setPassword,
  onSubmit,
  busy,
  error,
  title = 'Open the weekly planner',
  body = 'Sign in to review the week, make changes, and share the final plan.',
}: {
  password: string
  setPassword: (value: string) => void
  onSubmit: () => void
  busy: boolean
  error: string | null
  title?: string
  body?: string
}) {
  return (
    <main className="page-wrap px-4 py-8 sm:py-12">
      <section className="ledger-panel grid gap-10 overflow-hidden rounded-[2rem] px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="eyebrow">Weekly cleaning planner</p>
          <h1 className="display-title max-w-2xl text-5xl leading-[0.96] text-[var(--ink-strong)] sm:text-7xl">
            Keep the week clear, calm, and easy to run.
          </h1>
          <p className="max-w-xl text-base leading-8 text-[var(--ink-soft)] sm:text-lg">
            Review this week, move jobs around when needed, and keep one clean
            version of the plan ready to share.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['This week first', 'The home screen is built around the current week and what needs doing now.'],
              ['Changes to review', 'If bookings change, the app prepares an updated suggestion for you to approve.'],
              ['Simple messages', 'Ask for changes in plain language and review them before anything is applied.'],
            ].map(([label, copy]) => (
              <article key={label} className="mini-card">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
                  {label}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{copy}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="paper-stack rounded-[1.75rem] p-5 sm:p-7">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_24px_60px_rgba(83,65,40,0.08)]">
            <p className="eyebrow">Manager sign-in</p>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--ink-strong)]">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{body}</p>
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                onSubmit()
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
              <button type="submit" className="action-primary w-full" disabled={busy}>
                {busy ? 'Signing in...' : 'Sign in'}
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
