import * as cheerio from 'cheerio'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import env from '#start/env'
import { isSafeUrl, redactUrl } from '#app/utils/ssrf'
import { ensureTempDir, createTempFilePath, getFileSize, cleanupFile } from '#app/utils/file'
import type { BookSearchResult, DownloadResult } from '#app/types/book'

export default class AnnaArchiveService {
  private baseUrl: string
  private userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  private maxPageSize = 5 * 1024 * 1024 // 5MB

  constructor() {
    this.baseUrl = env.get('ANNA_ARCHIVE_URL', 'https://fr.annas-archive.gd').replace(/\/$/, '')
  }

  async search(query: string, maxResults: number = 10): Promise<BookSearchResult[]> {
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&lang=&content=book_any&ext=epub,pdf,mobi`

    const response = await fetch(url, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`)
    }

    const contentLength = Number.parseInt(response.headers.get('content-length') || '0')
    if (contentLength > this.maxPageSize) {
      throw new Error(`Search response too large: ${contentLength} bytes`)
    }

    const html = await response.text()
    if (html.length > this.maxPageSize) {
      throw new Error(`Search response too large: ${html.length} bytes`)
    }

    const $ = cheerio.load(html)
    const results: BookSearchResult[] = []
    const seenMd5 = new Set<string>()

    // Anna's Archive search results are links with href starting with /md5/
    $('a[href*="/md5/"]').each((_, el) => {
      if (results.length >= maxResults) return false

      const href = $(el).attr('href') || ''
      const md5Match = href.match(/\/md5\/([a-f0-9]{32})/i)
      if (!md5Match) return

      const md5 = md5Match[1].toLowerCase()
      if (seenMd5.has(md5)) return
      seenMd5.add(md5)

      const text = $(el).text().trim()
      if (!text || text.length < 5) return

      // Extract format from text
      let format = 'epub'
      const formatMatch = text.match(/\b(epub|pdf|mobi|azw3)\b/i)
      if (formatMatch) format = formatMatch[1].toLowerCase()

      // Extract size from text (supports French units too: Mo, Ko, Go)
      let size: string | null = null
      const sizeMatch = text.match(/([\d.,]+)\s*(MB|KB|GB|Mo|Ko|Go|B)\b/i)
      if (sizeMatch) {
        let unit = sizeMatch[2]
        // Normalize French units
        if (unit.toLowerCase() === 'mo') unit = 'MB'
        if (unit.toLowerCase() === 'ko') unit = 'KB'
        if (unit.toLowerCase() === 'go') unit = 'GB'
        size = `${sizeMatch[1]} ${unit}`
      }

      // Try to extract author - often format is "Title, Author [format] [size]"
      let title = text.slice(0, 200)
      let author = ''

      // Clean up title - remove format/size info that appears at the end
      title = title.replace(/\b(epub|pdf|mobi|azw3)\b.*$/i, '').trim()
      title = title.replace(/,\s*$/, '').trim()

      results.push({ md5, title, author, format, size })
    })

    return results
  }

  async getDownloadLinks(md5: string): Promise<string[]> {
    const pageUrl = `${this.baseUrl}/md5/${md5}`
    const response = await fetch(pageUrl, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch book page: ${response.status}`)
    }

    const contentLength = Number.parseInt(response.headers.get('content-length') || '0')
    if (contentLength > this.maxPageSize) {
      throw new Error(`Book page too large: ${contentLength} bytes`)
    }

    const html = await response.text()
    if (html.length > this.maxPageSize) {
      throw new Error(`Book page too large: ${html.length} bytes`)
    }

    const $ = cheerio.load(html)
    const links: string[] = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href || !href.startsWith('http')) return

      const text = $(el).text().toLowerCase()
      const isDownloadLink =
        text.includes('download') ||
        text.includes('télécharger') ||
        text.includes('get') ||
        text.includes('mirror') ||
        text.includes('libgen') ||
        href.includes('libgen') ||
        href.includes('/get.php')

      if (isDownloadLink && isSafeUrl(href)) {
        links.push(href)
      }
    })

    // Always append slow_download as fallback
    links.push(`${this.baseUrl}/slow_download/${md5}/0/0`)

    return links
  }

  async download(md5: string, format: string = 'epub'): Promise<DownloadResult> {
    const links = await this.getDownloadLinks(md5)
    await ensureTempDir()
    const tempPath = createTempFilePath(md5, format)

    for (const mirrorUrl of links) {
      // Skip .onion URLs
      if (mirrorUrl.includes('.onion')) continue

      try {
        console.log(`[librarian] Trying mirror: ${redactUrl(mirrorUrl)}`)

        const response = await fetch(mirrorUrl, {
          headers: { 'User-Agent': this.userAgent },
          signal: AbortSignal.timeout(60000),
          redirect: 'follow',
        })

        if (!response.ok || !response.body) continue

        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('text/html')) {
          // Intermediate HTML page - parse for real download link
          const contentLength = Number.parseInt(response.headers.get('content-length') || '0')
          if (contentLength > this.maxPageSize) continue

          const html = await response.text()
          if (html.length > this.maxPageSize) continue

          const realUrl = this.extractDownloadUrl(html, mirrorUrl)
          if (!realUrl) continue

          // Fetch the real file
          const fileResponse = await fetch(realUrl, {
            headers: { 'User-Agent': this.userAgent },
            signal: AbortSignal.timeout(120000),
            redirect: 'follow',
          })

          if (!fileResponse.ok || !fileResponse.body) continue

          await this.streamToFile(fileResponse.body, tempPath)
        } else {
          // Binary response - stream directly to file
          await this.streamToFile(response.body, tempPath)
        }

        // Validate file size
        const fileSize = await getFileSize(tempPath)
        if (fileSize < 1024) {
          await cleanupFile(tempPath)
          console.log(`[librarian] File too small (${fileSize} bytes), trying next mirror`)
          continue
        }

        const maxSize = env.get('MAX_FILE_SIZE_MB', 50) * 1024 * 1024
        if (fileSize > maxSize) {
          await cleanupFile(tempPath)
          throw new Error(`File exceeds maximum size of ${env.get('MAX_FILE_SIZE_MB', 50)}MB`)
        }

        return {
          filePath: tempPath,
          fileName: `${md5}.${format}`,
          format,
          sizeBytes: fileSize,
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('exceeds maximum size')) {
          throw error // Re-throw size limit errors
        }
        console.warn(
          `[librarian] Mirror failed (${redactUrl(mirrorUrl)}): ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        continue
      }
    }

    throw new Error(`All download mirrors exhausted for md5: ${md5}`)
  }

  private extractDownloadUrl(html: string, baseUrl: string): string | null {
    const $ = cheerio.load(html)

    // Look for direct file links
    const fileExtensions = ['.epub', '.pdf', '.mobi', '.azw3', '.fb2']
    let found: string | null = null

    $('a[href]').each((_, el) => {
      if (found) return false
      const href = $(el).attr('href')
      if (!href) return

      const isFileLink =
        fileExtensions.some((ext) => href.toLowerCase().includes(ext)) || href.includes('get.php')

      if (isFileLink) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          if (isSafeUrl(absoluteUrl)) {
            found = absoluteUrl
          }
        } catch {}
      }
    })

    return found
  }

  private async streamToFile(body: ReadableStream<Uint8Array>, filePath: string): Promise<void> {
    const nodeReadable = Readable.fromWeb(body as any)
    const writeStream = createWriteStream(filePath)
    await pipeline(nodeReadable, writeStream)
  }
}
