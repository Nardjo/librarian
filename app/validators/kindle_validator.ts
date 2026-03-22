import vine from '@vinejs/vine'

export const kindleValidator = vine.compile(
  vine.object({
    md5: vine.string().regex(/^[a-f0-9]{32}$/),
    kindleEmail: vine.string().email(),
    title: vine.string().trim().maxLength(200).optional(),
  })
)
