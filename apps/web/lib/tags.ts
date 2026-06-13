const KEY = 'quiet-tags'

function normalize(address: string): string {
  return address.toLowerCase()
}

function read(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

function write(data: Record<string, string[]>): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function getTags(address: string): string[] {
  return read()[normalize(address)] ?? []
}

export function addTag(address: string, tag: string): void {
  const trimmed = tag.trim()
  if (!trimmed) return
  const data = read()
  const key = normalize(address)
  const existing = data[key] ?? []
  if (existing.includes(trimmed)) return
  data[key] = [...existing, trimmed]
  write(data)
}

export function removeTag(address: string, tag: string): void {
  const data = read()
  const key = normalize(address)
  if (!data[key]) return
  data[key] = data[key].filter((t) => t !== tag)
  if (data[key].length === 0) delete data[key]
  write(data)
}

export function getAllTags(): Record<string, string[]> {
  return read()
}
