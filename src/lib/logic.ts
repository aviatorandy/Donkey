import type { Db, Interaction, MessageTemplate, Person, Tier } from './types'

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
  kind: 'birthday' | 'date' | 'catch-up'
  /** For kind 'date': what the date is. */
  label?: string
  /** For birthdays and dates: days until it happens. */
  inDays?: number
  reason: string
  /** Higher sorts first. */
  score: number
}

export function suggestions(db: Db, now: string): Suggestion[] {
  const last = lastContactMap(db)
  const out: Suggestion[] = []
  for (const p of db.people) {
    if (p.snoozeUntil && p.snoozeUntil > now) continue
    const events = [...(p.birthday ? [{ label: 'Birthday', date: p.birthday }] : []), ...(p.dates ?? [])]
    let soon: { label: string; d: number } | undefined
    for (const e of events) {
      const d = daysToBirthday(e.date, now)
      if (d !== undefined && d <= 14 && (!soon || d < soon.d)) soon = { label: e.label, d }
    }
    if (soon) {
      out.push({
        person: p,
        kind: soon.label === 'Birthday' ? 'birthday' : 'date',
        label: soon.label,
        inDays: soon.d,
        reason: soon.d === 0 ? `${soon.label} today` : `${soon.label} in ${soon.d} day${soon.d === 1 ? '' : 's'}`,
        score: 1000 - soon.d,
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

const isWork = (p: Person) => p.circle === 'business' || p.circle === 'client'

/** Templates offered for a nudge, best match first, then the user's own. */
export function templatesFor(s: Suggestion, custom: MessageTemplate[] = []): MessageTemplate[] {
  const out: MessageTemplate[] = []
  if (s.kind === 'birthday') out.push({ id: 'birthday', label: 'Birthday', text: "Happy birthday, {name}! Hope it's a great one." })
  if (s.kind === 'date')
    out.push({ id: 'date', label: s.label ?? 'Big day', text: `Hey {name}, thinking of you with ${(s.label ?? 'the big day').toLowerCase()} coming up.` })
  out.push(
    isWork(s.person)
      ? { id: 'checkin', label: 'Check in', text: "Hi {name}, it's been a while. Would love to hear what you're working on. Up for a quick catch-up?" }
      : { id: 'checkin', label: 'Check in', text: "Hey {name}! It's been too long. How have you been?" },
    { id: 'coffee', label: 'Coffee?', text: 'Hi {name}, I would love to catch up properly. Free for a coffee or a call in the next couple of weeks?' },
    { id: 'thinking', label: 'Thinking of you', text: "Hey {name}, you crossed my mind today. No need to reply, just hoping you're well." },
    { id: 'congrats', label: 'Congrats', text: 'Congrats, {name}! Just saw the news. So well deserved.' },
    ...custom,
  )
  return out
}
export const fillTemplate = (t: MessageTemplate, p: Person) => t.text.replaceAll('{name}', firstName(p))
export const draftMessage = (s: Suggestion) => fillTemplate(templatesFor(s)[0], s.person)

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
  const hay = [p.name, p.company, p.title, p.context, p.circle, tierLabel(p.tier), ...p.tags, ...p.facts]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t))
}

export const TIERS: { id: Tier; label: string; hint: string; cadenceDays?: number }[] = [
  { id: 'inner', label: 'Inner circle', hint: 'every 2 weeks', cadenceDays: 14 },
  { id: 'warm', label: 'Warm', hint: 'every 2 months', cadenceDays: 60 },
  { id: 'alive', label: 'Keep alive', hint: 'once a year', cadenceDays: 365 },
  { id: 'dormant', label: 'Dormant', hint: 'no nudges' },
]
export function tierLabel(t?: Tier): string {
  return TIERS.find((x) => x.id === t)?.label ?? 'Unsorted'
}
/** Moving someone to a tier resets their contact goal to that tier's default. */
export function withTier(p: Person, tier: Tier): Person {
  return { ...p, tier, cadenceDays: TIERS.find((x) => x.id === tier)?.cadenceDays }
}

/**
 * Guess a tier from what is already known, so sorting an import is one click.
 * Family and heavy message history are inner circle; any real signal is warm;
 * a little history is keep-alive; a bare contact is dormant.
 */
export function suggestTier(p: Person, mine: Interaction[]): Tier {
  const msgs = mine.reduce((n, i) => n + (i.count ?? 0), 0)
  const logged = mine.filter((i) => i.count === undefined).length
  if (p.circle === 'family' || msgs >= 200 || logged >= 5) return 'inner'
  if (p.circle === 'client' || msgs >= 20 || logged > 0 || p.facts.length > 0) return 'warm'
  if (mine.length > 0) return 'alive'
  return 'dormant'
}
export function suggestTiers(db: Db): Map<string, Tier> {
  const by = new Map<string, Interaction[]>()
  for (const i of db.interactions) by.set(i.personId, [...(by.get(i.personId) ?? []), i])
  return new Map(db.people.map((p) => [p.id, suggestTier(p, by.get(p.id) ?? [])]))
}

export function tierHealth(db: Db, now: string): { tier: Tier; label: string; total: number; overdue: number }[] {
  const last = lastContactMap(db)
  return TIERS.filter((t) => t.cadenceDays).map((t) => {
    const people = db.people.filter((p) => p.tier === t.id)
    return {
      tier: t.id,
      label: t.label,
      total: people.length,
      overdue: people.filter((p) => statusOf(p, last.get(p.id), now) === 'overdue').length,
    }
  })
}
