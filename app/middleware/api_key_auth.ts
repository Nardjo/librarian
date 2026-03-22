import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

export default class ApiKeyAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const authHeader = ctx.request.header('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.response.unauthorized({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.slice(7)
    const expectedKey = env.get('LIBRARIAN_API_KEY')

    // Timing-safe comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token)
    const expectedBuffer = Buffer.from(expectedKey)

    if (
      tokenBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(tokenBuffer, expectedBuffer)
    ) {
      return ctx.response.unauthorized({ error: 'Invalid API key' })
    }

    const output = await next()
    return output
  }
}
