export interface BookSearchResult {
  md5: string
  title: string
  author: string
  format: string
  size: string | null
}

export interface DownloadResult {
  filePath: string
  fileName: string
  format: string
  sizeBytes: number
}
