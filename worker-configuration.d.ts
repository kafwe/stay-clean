declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    ADMIN_PASSWORD: string
    SESSION_SECRET: string
    GOOGLE_PLACES_API_KEY?: string
    OPENAI_API_KEY?: string
    OPENAI_MODEL?: string
    VAPID_PUBLIC_KEY?: string
    VAPID_PRIVATE_KEY?: string
    APP_BASE_URL?: string
  }
}
