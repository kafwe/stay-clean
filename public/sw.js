const APP_CACHE = 'stayclean-app-v3'
const PAGE_CACHE = 'stayclean-pages-v1'
const DATA_CACHE = 'stayclean-data-v1'
const ASSET_CACHE = 'stayclean-assets-v1'
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting())
    return
  }

  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheUrls(event.data.urls))
    return
  }

  if (event.data?.type === 'CLEAR_DYNAMIC_CACHES') {
    event.waitUntil(clearDynamicCaches())
  }
})

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
            .filter(
              (cacheName) =>
                cacheName !== APP_CACHE &&
                cacheName !== PAGE_CACHE &&
                cacheName !== DATA_CACHE &&
                cacheName !== ASSET_CACHE,
            )
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

  if (requestUrl.pathname.startsWith('/_serverFn/')) {
    event.respondWith(networkFirstData(request))
    return
  }

  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    requestUrl.pathname.startsWith('/assets/')
  ) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  event.respondWith(cacheFirst(request))
})

async function networkFirstNavigation(request) {
  const pageCache = await caches.open(PAGE_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      pageCache.put(request, response.clone())
    }
    return response
  } catch {
    const cachedResponse = await pageCache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    const offlineResponse = await caches.match(OFFLINE_URL)
    if (offlineResponse) {
      return offlineResponse
    }

    return Response.error()
  }
}

async function networkFirstData(request) {
  const dataCache = await caches.open(DATA_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      dataCache.put(request, response.clone())
    }
    return response
  } catch {
    const cachedResponse = await dataCache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    return Response.json(
      {
        error: 'Offline and no cached data is available yet.',
      },
      {
        status: 503,
        headers: {
          'content-type': 'application/json',
        },
      },
    )
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok) {
    const assetCache = await caches.open(ASSET_CACHE)
    assetCache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const assetCache = await caches.open(ASSET_CACHE)
  const cached = await assetCache.match(request)

  const networkRequest = fetch(request)
    .then((response) => {
      if (response.ok) {
        assetCache.put(request, response.clone())
      }
      return response
    })
    .catch(() => cached)

  return cached || networkRequest
}

async function cacheUrls(urls) {
  const origin = self.location.origin
  const warmUrls = Array.from(
    new Set(
      urls.filter((url) => {
        try {
          return new URL(url, origin).origin === origin
        } catch {
          return false
        }
      }),
    ),
  )

  await Promise.all(
    warmUrls.map(async (url) => {
      const absoluteUrl = new URL(url, origin)
      const request = new Request(absoluteUrl.toString(), {
        credentials: 'same-origin',
      })

      try {
        const response = await fetch(request)
        if (!response.ok) {
          return
        }

        const targetCache = selectCache(request)
        const cache = await caches.open(targetCache)
        await cache.put(request, response.clone())
      } catch {
        // Ignore warm-cache failures so install/activation stays resilient.
      }
    }),
  )
}

function selectCache(request) {
  const url = new URL(request.url)
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(?:css|js|mjs|woff2?|png|jpe?g|svg|ico|json|txt)$/i.test(url.pathname)

  if (url.pathname.startsWith('/_serverFn/')) {
    return DATA_CACHE
  }

  if (request.mode === 'navigate' || !isStaticAsset) {
    return PAGE_CACHE
  }

  return ASSET_CACHE
}

async function clearDynamicCaches() {
  await Promise.all([
    caches.delete(PAGE_CACHE),
    caches.delete(DATA_CACHE),
    caches.delete(ASSET_CACHE),
  ])
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
