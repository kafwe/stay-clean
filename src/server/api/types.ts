import type { Hono } from 'hono'

export type ApiApp = Hono<{ Bindings: Cloudflare.Env }>

export interface ExecutionContextLike {
  executionCtx?: {
    waitUntil?: (promise: Promise<unknown>) => void
  }
}