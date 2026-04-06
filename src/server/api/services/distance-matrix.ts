import { seedDistanceMatrix } from '#/lib/dashboard'
import type { ExecutionContextLike } from '../types'

export function queueDistanceMatrixSeed(c: ExecutionContextLike) {
  const seedTask = seedDistanceMatrix().catch((error) => {
    console.error('Distance matrix auto-refresh failed', error)
  })

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(seedTask)
    return
  }

  void seedTask
}