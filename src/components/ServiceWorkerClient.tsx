import { useEffect, useState } from 'react'

function isServiceWorkerSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

export function ServiceWorkerClient() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      return
    }

    let registration: ServiceWorkerRegistration | null = null
    let updateTimer = 0
    let onUpdateFound: (() => void) | null = null

    const onControllerChange = () => {
      window.location.reload()
    }

    const attachWaitingWorker = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
      }
    }

    const watchInstallingWorker = (registration: ServiceWorkerRegistration) => {
      const installingWorker = registration.installing
      if (!installingWorker) {
        return
      }

      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          attachWaitingWorker(registration)
        }
      })
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((resolvedRegistration) => {
        registration = resolvedRegistration
        attachWaitingWorker(resolvedRegistration)

        onUpdateFound = () => {
          watchInstallingWorker(resolvedRegistration)
        }

        resolvedRegistration.addEventListener('updatefound', onUpdateFound)

        watchInstallingWorker(resolvedRegistration)

        updateTimer = window.setInterval(() => {
          void resolvedRegistration.update().catch(() => {
            // Ignore transient update check failures.
          })
        }, 60 * 60 * 1000)
      })
      .catch(() => {
        setWaitingWorker(null)
      })

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      if (registration && onUpdateFound) {
        registration.removeEventListener('updatefound', onUpdateFound)
      }
      if (updateTimer) {
        window.clearInterval(updateTimer)
      }
    }
  }, [])

  function applyUpdate() {
    if (!waitingWorker) {
      return
    }

    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  if (!waitingWorker) {
    return null
  }

  return (
    <div className="sw-update-toast" role="status" aria-live="polite">
      <p className="sw-update-copy">A new version is ready.</p>
      <button type="button" className="action-secondary" onClick={applyUpdate}>
        Update now
      </button>
    </div>
  )
}
