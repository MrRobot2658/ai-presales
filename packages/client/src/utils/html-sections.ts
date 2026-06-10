export interface HtmlSection {
  id: string
  title: string
  content: string
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseHtmlToSections(html: string): HtmlSection[] {
  const raw = html.trim()
  if (!raw) return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div data-root="1">${raw}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return []

  const sectionEls = root.querySelectorAll(':scope > section')
  if (sectionEls.length > 0) {
    return Array.from(sectionEls).map((el, index) => {
      const heading = el.querySelector('h1, h2, h3, h4')
      const title = heading?.textContent?.trim() || `Section ${index + 1}`
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelector('h1, h2, h3, h4')?.remove()
      const content = stripTags(clone.innerHTML) || title
      return { id: `s${index + 1}`, title, content }
    })
  }

  const headings = root.querySelectorAll(':scope > h1, :scope > h2, :scope > h3')
  if (headings.length > 0) {
    return Array.from(headings).map((heading, index) => ({
      id: `s${index + 1}`,
      title: heading.textContent?.trim() || `Section ${index + 1}`,
      content: stripTags(heading.nextElementSibling?.innerHTML || heading.textContent || ''),
    }))
  }

  const text = stripTags(raw)
  if (!text) return []
  return [{ id: 's1', title: '内容', content: text }]
}
