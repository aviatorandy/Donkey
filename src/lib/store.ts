import { useSyncExternalStore } from 'react'
import { emptyDb, type Db } from './types'
import { addDays, today } from './logic'

const KEY = 'donkey.v1'

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...emptyDb, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable or corrupt: start empty */
  }
  return emptyDb
}

let state: Db = load()
const listeners = new Set<() => void>()

export const getDb = () => state
export function update(fn: (d: Db) => Db) {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* keep working in memory */
  }
  listeners.forEach((l) => l())
}
export function useDb(): Db {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, getDb)
}

export const uid = () => crypto.randomUUID()

export function sampleDb(): Db {
  const t = today()
  const bday = addDays(t, 5).slice(5)
  const p = (id: string, rest: Omit<Db['people'][number], 'id' | 'tags' | 'facts'> & { tags?: string[]; facts?: string[] }) => ({
    id,
    tags: [],
    facts: [],
    ...rest,
  })
  return {
    people: [
      p('s1', { name: 'Maya Chen', circle: 'friend', context: 'College', phone: '+14155550101', cadenceDays: 30, birthday: bday, facts: ['Training for her first marathon', 'Daughter Lily started kindergarten'] }),
      p('s2', { name: 'Jordan Reyes', circle: 'friend', context: 'College', phone: '+14155550102', cadenceDays: 45, facts: ['Just moved to Austin', 'Allergic to shellfish'] }),
      p('s3', { name: 'Priya Natarajan', circle: 'business', company: 'Northwind', title: 'VP Operations', context: 'Northwind 2019-2022', cadenceDays: 90, tags: ['mentor'], facts: ['Prefers coffee over lunch', 'Hiring for a chief of staff'] }),
      p('s4', { name: 'Sam Okafor', circle: 'business', company: 'Northwind', title: 'Finance Lead', context: 'Northwind 2019-2022', cadenceDays: 120 }),
      p('s5', { name: 'Elena Rossi', circle: 'client', company: 'Brightline', title: 'COO', context: 'Consulting 2023', email: 'elena@example.com', cadenceDays: 60, tags: ['referral source'], facts: ['Renewal conversation due in Q1', 'Big Formula 1 fan'] }),
      p('s6', { name: 'Tom Becker', circle: 'client', company: 'Brightline', title: 'Head of Supply Chain', context: 'Consulting 2023', cadenceDays: 90 }),
      p('s7', { name: 'Aisha Khan', circle: 'business', company: 'Lumen Labs', title: 'Recruiter', context: 'Job search', cadenceDays: 30, tags: ['recruiter'], facts: ['Said ops roles open up in January'] }),
      p('s8', { name: 'Dad', circle: 'family', context: 'Family', phone: '+14155550108', cadenceDays: 7, facts: ['Knee surgery follow-up on the 20th'] }),
      p('s9', { name: 'Chris Lindgren', circle: 'business', company: 'Lumen Labs', title: 'Director, Biz Ops', context: 'Job search' }),
    ],
    interactions: [
      { id: 'i1', personId: 's1', date: addDays(t, -12), channel: 'imessage', note: 'Talked about race training plan' },
      { id: 'i2', personId: 's2', date: addDays(t, -70), channel: 'whatsapp', note: 'Helped pick a neighborhood in Austin' },
      { id: 'i3', personId: 's3', date: addDays(t, -80), channel: 'in-person', note: 'Coffee. She offered an intro to her COO network' },
      { id: 'i4', personId: 's5', date: addDays(t, -95), channel: 'email', note: 'Sent project wrap-up' },
      { id: 'i5', personId: 's7', date: addDays(t, -10), channel: 'linkedin', note: 'Intro call' },
      { id: 'i6', personId: 's8', date: addDays(t, -3), channel: 'call', note: 'Sunday call' },
      { id: 'i7', personId: 's4', date: addDays(t, -40), channel: 'linkedin', note: 'Congratulated on promotion' },
      { id: 'i8', personId: 's6', date: addDays(t, -30), channel: 'email', note: 'Shared the vendor scorecard template' },
    ],
    reminders: [
      { id: 'r1', personId: 's3', text: 'Ask Priya about the chief of staff role', due: addDays(t, 1), done: false },
      { id: 'r2', personId: 's8', text: 'Check how the knee follow-up went', due: addDays(t, -1), done: false },
    ],
  }
}
