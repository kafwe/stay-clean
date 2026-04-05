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
  const [pushState, setPushState] = useState<'unsupported' | 'idle' | 'enabling' | 'enabled' | 'blocked'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isIosStandalone, setIsIosStandalone] = useState(true)
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default')

  function detectIosStandalone() {
    const isIos = /iPad|iPhone|iPod/i.test(window.navigator.userAgent)
    if (!isIos) {
      return true
    }

    const safariStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
    return safariStandalone || displayStandalone
  }

  useEffect(() => {
    setPermissionState(typeof Notification === 'undefined' ? 'default' : Notification.permission)

    if (!authenticated || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setReady(false)
      setPushState('unsupported')
      return
    }

    const standalone = detectIosStandalone()
    setIsIosStandalone(standalone)
    if (!standalone) {
      setReady(false)
      setPushState('idle')
      setError(null)
      return
    }

    let cancelled = false

    void navigator.serviceWorker.ready
      .then(async (registration) => {
        if (cancelled) {
          return
        }

        setReady(true)
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          setPushState('enabled')
          setPermissionState('granted')
          return
        }

        if (Notification.permission === 'denied') {
          setPushState('blocked')
        }
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setReady(false)
        setPushState('unsupported')
      })

    return () => {
      cancelled = true
    }
  }, [authenticated])

  async function enablePush() {
    if (!isIosStandalone) {
      setError('Open this app in Safari, tap Share, then choose Add to Home Screen.')
      return
    }

    if (!ready) {
      setError('The app is still getting ready. Try again in a moment.')
      return
    }

    if (!vapidPublicKey) {
      setError('Add VAPID keys to enable push notifications.')
      return
    }

    setError(null)
    setPushState('enabling')
    let nextPermission: NotificationPermission = permissionState

    try {
      nextPermission = await Notification.requestPermission()
      setPermissionState(nextPermission)
      if (nextPermission !== 'granted') {
        setPushState(nextPermission === 'denied' ? 'blocked' : 'idle')
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
    } catch (subscriptionError) {
      setPushState(nextPermission === 'denied' ? 'blocked' : 'idle')
      setError(
        subscriptionError instanceof Error
          ? subscriptionError.message
          : 'Unable to finish reminder setup right now.',
      )
    }
  }

  const stepItems = [
    {
      label: 'Install app',
      status: isIosStandalone ? 'done' : 'current',
      copy: isIosStandalone
        ? 'This app is already running like an installed app.'
        : 'Open in Safari and add it to your Home Screen first.',
    },
    {
      label: 'Allow notifications',
      status:
        !isIosStandalone
          ? 'upcoming'
          : permissionState === 'granted'
            ? 'done'
            : pushState === 'blocked'
              ? 'blocked'
              : 'current',
      copy:
        permissionState === 'granted'
          ? 'Notification access has been granted on this device.'
          : pushState === 'blocked'
            ? 'Notifications were blocked. Re-enable them in browser settings.'
            : 'The app will ask for permission when you turn reminders on.',
    },
    {
      label: 'Reminders ready',
      status:
        pushState === 'enabled'
          ? 'done'
          : isIosStandalone && permissionState === 'granted'
            ? 'current'
            : 'upcoming',
      copy:
        pushState === 'enabled'
          ? 'Phone reminders are on for this manager device.'
          : 'Once connected, weekly review reminders can reach this phone.',
    },
  ] as const

  const actionDisabled =
    !ready ||
    pushState === 'enabled' ||
    pushState === 'unsupported' ||
    pushState === 'enabling' ||
    !isIosStandalone

  const helperCopy =
    pushState === 'unsupported'
      ? 'Push reminders are not available in this browser.'
      : pushState === 'enabled'
        ? 'This device is ready for reminder notifications.'
        : pushState === 'blocked'
          ? 'Notifications are blocked for this app right now.'
          : 'Set this up once on the manager phone, then reminders can be delivered here.'

  return (
    <div className="push-guide">
      <div className="push-guide-head">
        <p className="push-guide-title">Manager phone setup</p>
        <p className="push-guide-copy">{helperCopy}</p>
      </div>

      <div className="push-step-list" aria-label="Reminder setup steps">
        {stepItems.map((step, index) => (
          <div key={step.label} className={`push-step is-${step.status}`}>
            <span className="push-step-marker" aria-hidden="true">
              {step.status === 'done' ? '✓' : step.status === 'blocked' ? '!' : index + 1}
            </span>
            <div>
              <p className="push-step-title">{step.label}</p>
              <p className="push-step-copy">{step.copy}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="push-guide-actions">
        <button
          type="button"
          onClick={enablePush}
          disabled={actionDisabled}
          className="action-secondary"
        >
          {pushState === 'enabled'
            ? 'Phone reminders on'
            : pushState === 'enabling'
              ? 'Connecting...'
              : 'Turn on phone reminders'}
        </button>
        {!isIosStandalone ? (
          <p className="push-guide-hint">Use Safari on iPhone for the install step.</p>
        ) : null}
      </div>

      {error ? <p className="push-guide-error">{error}</p> : null}
    </div>
  )
}
