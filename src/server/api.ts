import { Hono } from 'hono'
import { registerApiAuthMiddleware } from './api/middleware/auth'
import { registerAuthRoutes } from './api/routes/auth'
import { registerDashboardRoutes } from './api/routes/dashboard'
import { registerPlacesRoutes } from './api/routes/places'
import { registerPushRoutes } from './api/routes/push'
import { registerScheduleRoutes } from './api/routes/schedule'
import { registerSetupRoutes } from './api/routes/setup'
import { registerSuggestionRoutes } from './api/routes/suggestions'
import { registerSystemRoutes } from './api/routes/system'

const app = new Hono<{ Bindings: Cloudflare.Env }>()

registerAuthRoutes(app)
registerApiAuthMiddleware(app)
registerDashboardRoutes(app)
registerPlacesRoutes(app)
registerSetupRoutes(app)
registerPushRoutes(app)
registerScheduleRoutes(app)
registerSuggestionRoutes(app)
registerSystemRoutes(app)

export { app }
