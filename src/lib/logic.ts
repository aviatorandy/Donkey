import type { Db, Person } from './types'

export const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())

const toUtc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86400000)
export const addDays = (s: string, n: number) => {
  const d = new Date(toUtc(s) + n * 86400000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const digits = (s?: string) => (s ?? '').replace(/\D/g, '')
/** Last 10 digits, so +1 (415) 555-0100 and 4155550100 match. */
export const phoneKey = (s?: string) => {
  const d = digits(s)
  return d.length >= 7 ? d.slice(-10) : ''
}
export const firstName = (p: Person) => p.name.trim().split(/\s+/)[0] ?? p.name

export function lastContactMap(db: Db): Map<string, string> {
  const m = new Map<string, string>()
  for (const i of db.interactions) {
    const cur = m.get(i.personId)
    if (!cur || i.date > cur) m.set(i.personId, i.date)
  }
  return m
}

export type Status = 'ok' | 'due' | 'overdue' | 'none'

/** due = within 20% of the cadence window; overdue = past it. */
export function statusOf(p: Person, last: string | undefined, now: string): Status {
  if (!p.cadenceDays) return 'none'
  if (!last) return 'overdue'
  const since = daysBetween(last, now)
  if (since >= p.cadenceDays) return 'overdue'
  if (since >= p.cadenceDays * 0.8) return 'due'
  return 'ok'
}

/** Days until the next occurrence of a MM-DD or YYYY-MM-DD birthday. */
export function daysToBirthday(birthday: string | undefined, now: string): number | undefined {
  if (!birthday) return undefined
  const parts = birthday.split('-')
  const [mm, dd] = parts.slice(-2)
  if (!mm || !dd) return undefined
  const year = Number(now.slice(0, 4))
  let next = `${year}-${mm}-${dd}`
  if (next < now) next = `${year + 1}-${mm}-${dd}`
  return daysBetween(now, next)
}

export interface Suggestion {
  person: Person
  kind: 'birthday' | 'catch-up'
  reason: string
  /** Higher sorts first. */
  score: number
}

export function suggestions(db: Db, now: string): Suggestion[] {
  const last = lastContactMap(db)
  const out: Suggestion[] = []
  for (const p of db.people) {
    const b = daysToBirthday(p.birthday, now)
    if (b !== undefined && b <= 14) {
      out.push({
        person: p,
        kind: 'birthday',
        reason: b === 0 ? 'Birthday today' : `Birthday in ${b} day${b === 1 ? '' : 's'}`,
        score: 1000 - b,
      })
      continue
    }
    const st = statusOf(p, last.get(p.id), now)
    if (st === 'overdue' || st === 'due') {
      const l = last.get(p.id)
      const since = l ? daysBetween(l, now) : undefined
      out.push({
        person: p,
        kind: 'catch-up',
        reason:
          since === undefined
            ? 'No contact logged yet'
            : `${since} days since last contact (goal: every ${p.cadenceDays})`,
        score: since === undefined ? 1 : since / (p.cadenceDays ?? 1),
      })
    }
  }
  return out.sort((a, b) => b.score - a.score)
}

export function draftMessage(s: Suggestion): string {
  const name = firstName(s.person)
  if (s.kind === 'birthday') return `Happy birthday, ${name}! Hope it's a great one.`
  return s.person.circle === 'business' || s.person.circle === 'client'
    ? `Hi ${name}, it's been a while. Would love to hear what you're working on. Up for a quick catch-up?`
    : `Hey ${name}! It's been too long. How have you been?`
}

export function sendLinks(p: Person, text: string): { label: string; href: string }[] {
  const enc = encodeURIComponent(text)
  const links: { label: string; href: string }[] = []
  if (p.phone) {
    links.push({ label: 'iMessage', href: `sms:${p.phone}?&body=${enc}` })
    links.push({ label: 'WhatsApp', href: `https://wa.me/${digits(p.phone)}?text=${enc}` })
  }
  if (p.linkedin) links.push({ label: 'LinkedIn', href: p.linkedin })
  if (p.email) links.push({ label: 'Email', href: `mailto:${p.email}?body=${enc}` })
  return links
}

export function matchesQuery(p: Person, q: string): boolean {
  if (!q.trim()) return true
  const hay = [p.name, p.company, p.title, p.context, p.circle, ...p.tags, ...p.facts]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t))
}
