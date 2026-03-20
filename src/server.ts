import handler from '@tanstack/react-start/server-entry'
import { app } from './server/api'
import { regenerateWeekFromICal } from './lib/dashboard'
import { getNextWeekStartIso } from './lib/date'

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const pathname = new URL(request.url).pathname

    if (pathname.startsWith('/api/')) {
      return app.fetch(request, env, ctx)
    }

    return handler.fetch(request)
  },
  scheduled(controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    if (controller.cron === '0 12 * * SUN') {
      ctx.waitUntil(regenerateWeekFromICal('cron', getNextWeekStartIso()))
      return
    }

    if (controller.cron === '0 */4 * * *') {
      ctx.waitUntil(regenerateWeekFromICal('cron'))
    }
  },
}
