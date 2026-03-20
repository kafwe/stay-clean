import { env } from 'cloudflare:workers'
import { buildPushHTTPRequest } from '@pushforge/builder'
import { listPushSubscriptions, removePushSubscription } from './db'

export async function sendPushToManager(input: {
  title: string
  body: string
  url: string
}) {
  if (!env.VAPID_PRIVATE_KEY) {
    return
  }

  const subscriptions = await listPushSubscriptions()
  if (!subscriptions.length) {
    return
  }

  for (const subscription of subscriptions) {
    try {
      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY),
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        message: {
          payload: {
            title: input.title,
            body: input.body,
            url: input.url,
            icon: '/logo192.png',
            badge: '/logo192.png',
          },
          adminContact: 'mailto:stayclean@example.com',
          options: {
            urgency: 'high',
            ttl: 60 * 60 * 2,
          },
        },
      })

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      })

      if (response.status === 404 || response.status === 410) {
        await removePushSubscription(subscription.endpoint)
      }
    } catch {
      await removePushSubscription(subscription.endpoint)
    }
  }
}
