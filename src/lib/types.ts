export type Circle = 'friend' | 'family' | 'business' | 'client'
/** How close you want to keep someone. Unset means not sorted yet. */
export type Tier = 'inner' | 'warm' | 'alive' | 'dormant'
export type Channel = 'imessage' | 'whatsapp' | 'linkedin' | 'email' | 'call' | 'in-person' | 'other'

export interface Person {
  id: string
  name: string
  circle: Circle
  company?: string
  title?: string
  /** How you know them: a career chapter, school, city, etc. */
  context?: string
  phone?: string
  email?: string
  linkedin?: string
  /** MM-DD or YYYY-MM-DD */
  birthday?: string
  tier?: Tier
  /** Hide nudges for this person until this date (YYYY-MM-DD). */
  snoozeUntil?: string
  /** Other dates worth remembering: anniversaries, kids' birthdays. Dates are MM-DD. */
  dates?: { label: string; date: string }[]
  /** Target days between touchpoints. Unset means no nudges. */
  cadenceDays?: number
  tags: string[]
  /** The small things worth remembering. */
  facts: string[]
}

export interface Interaction {
  id: string
  personId: string
  /** YYYY-MM-DD */
  date: string
  channel: Channel
  note: string
  /** Set on imported message summaries: how many messages they cover. */
  count?: number
}

export interface Reminder {
  id: string
  personId?: string
  text: string
  /** YYYY-MM-DD */
  due: string
  done: boolean
}

/** A reusable message. `{name}` is replaced with the person's first name. */
export interface MessageTemplate {
  id: string
  label: string
  text: string
}

export interface Db {
  people: Person[]
  interactions: Interaction[]
  reminders: Reminder[]
  /** Templates the user saved, shown after the built-in ones. */
  templates?: MessageTemplate[]
  /** True while the app is showing sample data, not the user's own. */
  sample?: boolean
}

export const emptyDb: Db = { people: [], interactions: [], reminders: [] }
