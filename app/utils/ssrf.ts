import { isIP } from 'node:net'

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^127\./,
  /^0\./,
]

function isPrivateIp(ip: string): boolean {
  if (ip === '::1') return true
  return PRIVATE_IP_RANGES.some((range) => range.test(ip))
}

export function isSafeUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)

    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    const hostname = parsed.hostname

    // Block localhost
    if (hostname === 'localhost' || hostname === '::1') {
      return false
    }

    // If the hostname is an IP address, check if it's private
    if (isIP(hostname)) {
      return !isPrivateIp(hostname)
    }

    return true
  } catch {
    return false
  }
}

export function isTrustedUrl(urlString: string, baseUrl: string): boolean {
  if (!isSafeUrl(urlString)) return false
  return urlString.startsWith(baseUrl)
}

export function redactUrl(urlString: string): string {
  try {
    const parsed = new URL(urlString)
    parsed.search = ''
    return parsed.toString()
  } catch {
    return '[invalid url]'
  }
}
