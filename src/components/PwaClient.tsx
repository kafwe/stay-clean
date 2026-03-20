import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

async function postSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })

  if (!response.ok) {
    throw new Error('Unable to save the push subscription')
  }
}

export function PwaClient({
  authenticated,
  vapidPublicKey,
}: {
  authenticated: boolean
  vapidPublicKey: string | null
}) {
  const [ready, setReady] = useState(false)
  const [pushState, setPushState] = useState<'unsupported' | 'idle' | 'enabled'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authenticated || !('serviceWorker' in navigator)) {
      setPushState('unsupported')
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then(async () => {
        setReady(true)
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          setPushState('enabled')
        }
      })
      .catch(() => {
        setPushState('unsupported')
      })
  }, [authenticated])

  async function enablePush() {
    if (!vapidPublicKey) {
      setError('Add VAPID keys to enable push notifications.')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setError('Notification permission was not granted.')
      return
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    await postSubscription(subscription)
    setPushState('enabled')
    setError(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={enablePush}
        disabled={!ready || pushState === 'enabled' || pushState === 'unsupported'}
        className="action-secondary disabled:opacity-50"
      >
        {pushState === 'enabled' ? 'Phone reminders on' : 'Turn on phone reminders'}
      </button>
      {error ? <p className="text-sm text-[var(--accent-deep)]">{error}</p> : null}
    </div>
  )
}
