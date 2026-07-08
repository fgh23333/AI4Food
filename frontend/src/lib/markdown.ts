import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export function renderMarkdown(src: string | undefined): string {
  if (!src) return ''
  return DOMPurify.sanitize(marked.parse(src) as string)
}
