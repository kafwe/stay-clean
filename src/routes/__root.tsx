import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, Link, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ServiceWorkerClient } from '#/components/ServiceWorkerClient'
import appCss from '../styles.css?url'

type RouterAppContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'StayClean',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'StayClean',
      },
      {
        name: 'theme-color',
        content: '#f5f5dc',
      },
      {
        name: 'description',
        content: 'A friendly weekly cleaning planner for Cape Town short-stay homes.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/icon-master.svg',
      },
      {
        rel: 'icon',
        href: '/logo192.png',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
      {
        rel: 'apple-touch-startup-image',
        href: '/splash/apple-splash-1170x2532.png',
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        rel: 'apple-touch-startup-image',
        href: '/splash/apple-splash-2532x1170.png',
        media:
          '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
      },
      {
        rel: 'apple-touch-startup-image',
        href: '/splash/apple-splash-1179x2556.png',
        media:
          '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        rel: 'apple-touch-startup-image',
        href: '/splash/apple-splash-2556x1179.png',
        media:
          '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
      },
      {
        rel: 'apple-touch-startup-image',
        href: '/splash/apple-splash-1290x2796.png',
        media:
          '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        rel: 'apple-touch-startup-image',
        href: '/splash/apple-splash-2796x1290.png',
        media:
          '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
})

function RootNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-(--ink-strong)">This page is not available right now</h1>
      <p className="mt-3 text-sm leading-7 text-(--ink-soft)">
        The link may be old, or the page may have moved.
      </p>
      <Link to="/" className="action-secondary mt-5 inline-flex">
        Go to week view
      </Link>
    </main>
  )
}

function RootError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong while loading this screen.'

  return (
    <main className="mx-auto max-w-xl px-6 py-14">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold text-(--ink-strong)">This screen could not be loaded</h1>
      <p className="mt-3 text-sm leading-7 text-(--ink-soft)">{message}</p>
      <Link to="/" className="action-secondary mt-5 inline-flex">
        Go to week view
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased wrap-anywhere selection:bg-[rgba(164,126,89,0.18)]">
        {children}
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ) : null}
        <ServiceWorkerClient />
        <Scripts />
      </body>
    </html>
  )
}
