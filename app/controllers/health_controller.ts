import type { HttpContext } from '@adonisjs/core/http'

export default class HealthController {
  async handle({ response }: HttpContext) {
    return response.ok({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  }
}
