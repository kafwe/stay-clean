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
    throw new Error('Could not save reminder setup right now. Please try again.')
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
      setError('Open this app in Safari, then add it to your Home Screen first.')
      return
    }

    if (!ready) {
      setError('The app is still getting ready. Please try again in a moment.')
      return
    }

    if (!vapidPublicKey) {
      setError('Push reminders are not configured yet.')
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
        setError('Notification permission is needed to send reminders to this phone.')
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
          : 'Could not finish reminder setup right now.',
      )
    }
  }

  const stepItems = [
    {
      label: 'Install app',
      status: isIosStandalone ? 'done' : 'current',
      copy: isIosStandalone
        ? 'Installed on this phone.'
        : 'Add this app to your Home Screen in Safari.',
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
          ? 'Notifications are allowed on this phone.'
          : pushState === 'blocked'
            ? 'Notifications are blocked. Re-enable them in Safari settings.'
            : 'You will be asked for notification permission.',
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
          ? 'Weekly reminders are on for this phone.'
          : 'Turn reminders on to receive weekly review prompts.',
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
      ? 'This browser does not support push reminders.'
      : pushState === 'enabled'
        ? 'This phone is ready for weekly reminders.'
        : pushState === 'blocked'
          ? 'Notifications are blocked for this app right now.'
          : 'Set this up once on the manager phone.'

  return (
    <div className="push-guide">
      <div className="push-guide-head">
        <p className="push-guide-title">Manager phone reminders</p>
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
            ? 'Reminders on'
            : pushState === 'enabling'
              ? 'Connecting...'
              : 'Turn on reminders'}
        </button>
      </div>

      {error ? <p className="push-guide-error">{error}</p> : null}
    </div>
  )
}
