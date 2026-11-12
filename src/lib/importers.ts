import type { Db, Interaction, Person } from './types'
import { pad, phoneKey } from './logic'

export type NewPerson = Omit<Person, 'id'>

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** LinkedIn data export: Connections.csv (has a notes preamble before the header). */
export function parseLinkedIn(text: string): NewPerson[] {
  const rows = parseCsv(text.replace(/^﻿/, ''))
  const h = rows.findIndex((r) => r[0]?.trim() === 'First Name')
  if (h < 0) throw new Error('Not a LinkedIn Connections.csv: no "First Name" header found')
  const col = (name: string) => rows[h].findIndex((c) => c.trim() === name)
  const [fn, ln, url, email, company, position] = [
    'First Name',
    'Last Name',
    'URL',
    'Email Address',
    'Company',
    'Position',
  ].map(col)
  const out: NewPerson[] = []
  for (const r of rows.slice(h + 1)) {
    const name = `${r[fn] ?? ''} ${r[ln] ?? ''}`.trim()
    if (!name) continue
    out.push({
      name,
      circle: 'business',
      company: r[company]?.trim() || undefined,
      title: r[position]?.trim() || undefined,
      linkedin: r[url]?.trim() || undefined,
      email: r[email]?.trim() || undefined,
      tags: ['linkedin'],
      facts: [],
    })
  }
  return out
}

/** vCard (.vcf) export from Apple Contacts / Google Contacts. */
export function parseVCard(text: string): NewPerson[] {
  const out: NewPerson[] = []
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  for (const card of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    const get = (key: string) => {
      const m = card.match(new RegExp(`^(?:item\\d+\\.)?${key}(?:;[^:\\n]*)?:(.*)$`, 'im'))
      return m?.[1].trim() || undefined
    }
    const name = get('FN')
    if (!name) continue
    const bday = get('BDAY')?.match(/(\d{4}|-)-?(\d{2})-?(\d{2})/)
    out.push({
      name,
      circle: 'friend',
      company: get('ORG')?.split(';')[0] || undefined,
      title: get('TITLE'),
      phone: get('TEL'),
      email: get('EMAIL'),
      birthday: bday ? (bday[1] === '-' || bday[1] === '1604' ? '' : `${bday[1]}-`) + `${bday[2]}-${bday[3]}` : undefined,
      tags: [],
      facts: [],
    })
  }
  return out
}

export interface ChatSummary {
  sender: string
  count: number
  /** YYYY-MM-DD */
  last: string
}

const WA_IOS = /^‎?\[(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s[^\]]*\]\s([^:]+):\s/
const WA_ANDROID = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4}),?\s[^-]*-\s([^:]+):\s/

/** WhatsApp "Export chat" .txt (iOS and Android formats). One summary per sender. */
export function parseWhatsApp(text: string): ChatSummary[] {
  const hits: { a: number; b: number; y: number; sender: string }[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(WA_IOS) ?? line.match(WA_ANDROID)
    if (m) hits.push({ a: +m[1], b: +m[2], y: +m[3] < 100 ? 2000 + +m[3] : +m[3], sender: m[4].trim() })
  }
  // The export follows the phone's locale. Day-first unless a second field exceeds 12.
  const monthFirst = hits.some((h) => h.b > 12) && !hits.some((h) => h.a > 12)
  const by = new Map<string, ChatSummary>()
  for (const h of hits) {
    const [mo, d] = monthFirst ? [h.a, h.b] : [h.b, h.a]
    const date = `${h.y}-${pad(mo)}-${pad(d)}`
    const cur = by.get(h.sender) ?? { sender: h.sender, count: 0, last: date }
    cur.count++
    if (date > cur.last) cur.last = date
    by.set(h.sender, cur)
  }
  return [...by.values()]
}

export interface IMessageRow {
  handle: string
  total: number
  sent: number
  /** YYYY-MM-DD */
  last: string
}

const norm = (s?: string) => (s ?? '').trim().toLowerCase()

function findMatch(people: Person[], p: Partial<Person>): Person | undefined {
  const pk = phoneKey(p.phone)
  return people.find(
    (e) =>
      (p.linkedin && norm(e.linkedin) === norm(p.linkedin)) ||
      (p.email && norm(e.email) === norm(p.email)) ||
      (pk && phoneKey(e.phone) === pk) ||
      (p.name && norm(e.name) === norm(p.name)),
  )
}

/** Adds new people; fills blank fields on existing ones. Never overwrites what you typed. */
export function mergePeople(db: Db, incoming: NewPerson[]): { db: Db; added: number; updated: number } {
  const people = db.people.map((p) => ({ ...p }))
  let added = 0
  let updated = 0
  for (const inc of incoming) {
    const hit = findMatch(people, inc)
    if (!hit) {
      people.push({ ...inc, id: crypto.randomUUID() })
      added++
      continue
    }
    let changed = false
    for (const k of ['company', 'title', 'phone', 'email', 'linkedin', 'birthday'] as const) {
      if (!hit[k] && inc[k]) {
        hit[k] = inc[k]
        changed = true
      }
    }
    for (const t of inc.tags)
      if (!hit.tags.includes(t)) {
        hit.tags = [...hit.tags, t]
        changed = true
      }
    if (changed) updated++
  }
  return { db: { ...db, people }, added, updated }
}

function upsertInteraction(list: Interaction[], i: Interaction) {
  const idx = list.findIndex((x) => x.id === i.id)
  if (idx >= 0) list[idx] = i
  else list.push(i)
}

/** Re-importing the same chat replaces its summary rather than duplicating it. */
export function applyWhatsApp(
  db: Db,
  chats: ChatSummary[],
  me: string,
): { db: Db; matched: string[]; unmatched: string[] } {
  const interactions = [...db.interactions]
  const matched: string[] = []
  const unmatched: string[] = []
  for (const c of chats) {
    if (c.sender === me) continue
    const p = findMatch(db.people, { name: c.sender, phone: c.sender })
    if (!p) {
      unmatched.push(c.sender)
      continue
    }
    matched.push(p.name)
    upsertInteraction(interactions, {
      id: `wa:${p.id}`,
      personId: p.id,
      date: c.last,
      channel: 'whatsapp',
      note: `WhatsApp import: ${c.count} messages from them, latest on this date`,
    })
  }
  return { db: { ...db, interactions }, matched, unmatched }
}

export function applyIMessage(
  db: Db,
  rows: IMessageRow[],
): { db: Db; matched: string[]; unmatched: IMessageRow[] } {
  const interactions = [...db.interactions]
  const matched: string[] = []
  const unmatched: IMessageRow[] = []
  for (const r of rows) {
    const p = findMatch(db.people, r.handle.includes('@') ? { email: r.handle } : { phone: r.handle })
    if (!p) {
      unmatched.push(r)
      continue
    }
    matched.push(p.name)
    upsertInteraction(interactions, {
      id: `im:${p.id}:${r.handle}`,
      personId: p.id,
      date: r.last,
      channel: 'imessage',
      note: `iMessage import: ${r.total} messages (${r.sent} from you), latest on this date`,
    })
  }
  unmatched.sort((a, b) => b.total - a.total)
  return { db: { ...db, interactions }, matched, unmatched }
}
