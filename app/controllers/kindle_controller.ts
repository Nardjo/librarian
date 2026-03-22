import type { HttpContext } from '@adonisjs/core/http'
import { kindleValidator } from '#validators/kindle_validator'
import AnnaArchiveService from '#services/anna_archive_service'
import KindleService from '#services/kindle_service'
import { cleanupFile } from '#utils/file'

export default class KindleController {
  async handle({ request, response }: HttpContext) {
    const payload = await request.validateUsing(kindleValidator)
    const annaService = new AnnaArchiveService()
    const kindleService = new KindleService()

    let downloadResult
    try {
      downloadResult = await annaService.download(payload.md5)
    } catch (error) {
      return response.serviceUnavailable({
        error: 'Failed to download book',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    try {
      await kindleService.sendToKindle(downloadResult.filePath, payload.kindleEmail, payload.title)
    } catch (error) {
      return response.serviceUnavailable({
        error: 'Failed to send to Kindle',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      await cleanupFile(downloadResult.filePath)
    }

    return response.ok({
      status: 'sent',
      md5: payload.md5,
      kindleEmail: payload.kindleEmail,
      fileName: downloadResult.fileName,
      sizeBytes: downloadResult.sizeBytes,
    })
  }
}
