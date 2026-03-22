import vine from '@vinejs/vine'

export const searchValidator = vine.compile(
  vine.object({
    query: vine.string().trim().minLength(1).maxLength(500),
    formats: vine.array(vine.enum(['epub', 'pdf', 'mobi'])).optional(),
    maxResults: vine.number().min(1).max(10).optional(),
  })
)
