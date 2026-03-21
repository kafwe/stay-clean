self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

const APP_CACHE = 'stayclean-app-v2'
const RUNTIME_CACHE = 'stayclean-runtime-v2'
const OFFLINE_URL = '/offline.html'
const APP_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/apple-touch-icon.png',
  '/splash/apple-splash-1170x2532.png',
  '/splash/apple-splash-2532x1170.png',
  '/splash/apple-splash-1179x2556.png',
  '/splash/apple-splash-2556x1179.png',
  '/splash/apple-splash-1290x2796.png',
  '/splash/apple-splash-2796x1290.png',
  OFFLINE_URL,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_ASSETS))
      .catch(() => {
        // Keep install resilient when one asset is temporarily unavailable.
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== APP_CACHE && cacheName !== RUNTIME_CACHE)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(request.url)
  if (requestUrl.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font' || request.destination === 'image' || requestUrl.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  event.respondWith(cacheFirst(request))
})

async function networkFirstNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    const offlineResponse = await caches.match(OFFLINE_URL)
    if (offlineResponse) {
      return offlineResponse
    }

    return Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok) {
    const runtimeCache = await caches.open(RUNTIME_CACHE)
    runtimeCache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE)
  const cached = await runtimeCache.match(request)

  const networkRequest = fetch(request)
    .then((response) => {
      if (response.ok) {
        runtimeCache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || networkRequest
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(payload.title || 'StayClean', {
      body: payload.body || 'There is an update waiting for review.',
      icon: payload.icon || '/logo192.png',
      badge: payload.badge || '/logo192.png',
      data: {
        url: payload.url || '/',
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(targetUrl))
})
