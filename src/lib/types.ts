export type Circle = 'friend' | 'family' | 'business' | 'client'
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
}

export interface Reminder {
  id: string
  personId?: string
  text: string
  /** YYYY-MM-DD */
  due: string
  done: boolean
}

export interface Db {
  people: Person[]
  interactions: Interaction[]
  reminders: Reminder[]
}

export const emptyDb: Db = { people: [], interactions: [], reminders: [] }
