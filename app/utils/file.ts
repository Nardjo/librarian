import { mkdir, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import env from '#start/env'

export function getTempDir(): string {
  return env.get('TEMP_DIR', '/tmp/librarian')
}

export async function ensureTempDir(): Promise<string> {
  const dir = getTempDir()
  await mkdir(dir, { recursive: true })
  return dir
}

export function sanitizeExtension(ext: string): string {
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '')
  return clean.slice(0, 10) || 'epub'
}

export function createTempFilePath(md5: string, ext: string): string {
  return join(getTempDir(), `librarian_${md5}.${sanitizeExtension(ext)}`)
}

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath)
  } catch {}
}

export async function getFileSize(filePath: string): Promise<number> {
  const s = await stat(filePath)
  return s.size
}
