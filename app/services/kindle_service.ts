import nodemailer from 'nodemailer'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import env from '#start/env'

export default class KindleService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT', 587),
      secure: false, // STARTTLS
      auth: {
        user: env.get('SMTP_USER'),
        pass: env.get('SMTP_PASSWORD'),
      },
    })
  }

  async sendToKindle(filePath: string, kindleEmail: string, title?: string): Promise<void> {
    // Validate file size
    const fileStat = await stat(filePath)
    const maxSize = env.get('MAX_FILE_SIZE_MB', 50) * 1024 * 1024
    if (fileStat.size > maxSize) {
      throw new Error(
        `File too large: ${(fileStat.size / 1024 / 1024).toFixed(1)}MB exceeds ${env.get('MAX_FILE_SIZE_MB', 50)}MB limit`
      )
    }

    const fileName = title ? `${title}.${basename(filePath).split('.').pop()}` : basename(filePath)

    await this.transporter.sendMail({
      from: env.get('SMTP_FROM'),
      to: kindleEmail,
      subject: title || 'convert',
      text: '',
      attachments: [
        {
          filename: fileName,
          path: filePath,
        },
      ],
    })

    console.log(
      `[librarian] Book sent to Kindle: ${kindleEmail.replace(/(.{3}).*(@.*)/, '$1***$2')}`
    )
  }
}
