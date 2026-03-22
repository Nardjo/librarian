import type { HttpContext } from '@adonisjs/core/http'
import { searchValidator } from '#validators/search_validator'
import AnnaArchiveService from '#services/anna_archive_service'

export default class SearchController {
  async handle({ request, response }: HttpContext) {
    const payload = await request.validateUsing(searchValidator)
    const service = new AnnaArchiveService()

    try {
      const results = await service.search(payload.query, payload.maxResults ?? 10)
      return response.ok({
        query: payload.query,
        count: results.length,
        results,
      })
    } catch (error) {
      return response.serviceUnavailable({
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
