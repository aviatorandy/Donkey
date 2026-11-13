import { describe, expect, it } from 'vitest'
import { applyIMessage, applyWhatsApp, mergePeople, parseCsv, parseLinkedIn, parseVCard, parseWhatsApp } from '../src/lib/importers'
import { daysToBirthday, matchesQuery, statusOf, suggestions } from '../src/lib/logic'
import { emptyDb, type Db, type Person } from '../src/lib/types'

const person = (over: Partial<Person>): Person => ({ id: 'p1', name: 'Maya Chen', circle: 'friend', tags: [], facts: [], ...over })

describe('importers', () => {
  it('parses quoted CSV cells', () => {
    expect(parseCsv('a,"b, ""c""",d\r\n1,"x\ny",3')).toEqual([
      ['a', 'b, "c"', 'd'],
      ['1', 'x\ny', '3'],
    ])
  })

  it('reads LinkedIn Connections.csv past the notes preamble', () => {
    const csv = [
      'Notes:',
      '"When exporting your connection data, some emails may be missing."',
      '',
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      'Priya,Natarajan,https://www.linkedin.com/in/priya,,"Northwind, Inc.",VP Operations,12 Nov 2024',
    ].join('\n')
    expect(parseLinkedIn(csv)).toEqual([
      expect.objectContaining({ name: 'Priya Natarajan', company: 'Northwind, Inc.', title: 'VP Operations', linkedin: 'https://www.linkedin.com/in/priya', email: undefined }),
    ])
    expect(() => parseLinkedIn('foo,bar')).toThrow()
  })

  it('reads vCards including yearless birthdays', () => {
    const vcf = 'BEGIN:VCARD\nVERSION:3.0\nFN:Maya Chen\nORG:Acme;Ops\nitem1.TEL;type=CELL:+1 (415) 555-0101\nEMAIL;type=HOME:maya@example.com\nBDAY:1990-05-12\nEND:VCARD\nBEGIN:VCARD\nFN:Dad\nBDAY:--0704\nEND:VCARD'
    const [a, b] = parseVCard(vcf)
    expect(a).toMatchObject({ name: 'Maya Chen', company: 'Acme', phone: '+1 (415) 555-0101', email: 'maya@example.com', birthday: '1990-05-12' })
    expect(b).toMatchObject({ name: 'Dad', birthday: '07-04' })
  })

  it('summarises WhatsApp exports in iOS and Android formats', () => {
    const ios = '[11/3/24, 9:15:02 PM] Maya Chen: hey\n[11/25/24, 8:00:00 AM] Me: hi\nwrapped line\n[11/26/24, 8:00:00 AM] Maya Chen: ok'
    expect(parseWhatsApp(ios)).toEqual([
      { sender: 'Maya Chen', count: 2, last: '2024-11-26' },
      { sender: 'Me', count: 1, last: '2024-11-25' },
    ])
    const android = '25/11/2024, 08:00 - Maya Chen: hi\n25/11/2024, 08:01 - Messages are end-to-end encrypted'
    expect(parseWhatsApp(android)).toEqual([{ sender: 'Maya Chen', count: 1, last: '2024-11-25' }])
  })

  it('merges without duplicating or overwriting', () => {
    const db: Db = { ...emptyDb, people: [person({ company: 'Mine', phone: '(415) 555-0101' })] }
    const r = mergePeople(db, [
      { name: 'M. Chen', circle: 'business', phone: '+14155550101', company: 'Theirs', email: 'm@x.com', tags: ['linkedin'], facts: [] },
      { name: 'New Person', circle: 'business', tags: [], facts: [] },
    ])
    expect(r.added).toBe(1)
    expect(r.updated).toBe(1)
    expect(r.db.people[0]).toMatchObject({ name: 'Maya Chen', company: 'Mine', email: 'm@x.com', tags: ['linkedin'] })
  })

  it('applies message history idempotently', () => {
    const db: Db = { ...emptyDb, people: [person({ phone: '+1 415 555 0101' })] }
    const chats = [
      { sender: 'Maya Chen', count: 2, last: '2024-11-26' },
      { sender: 'Me', count: 1, last: '2024-11-25' },
      { sender: 'Stranger', count: 1, last: '2024-11-25' },
    ]
    const once = applyWhatsApp(db, chats, 'Me')
    const twice = applyWhatsApp(once.db, chats, 'Me')
    expect(twice.db.interactions).toHaveLength(1)
    expect(twice.unmatched).toEqual(['Stranger'])

    const im = applyIMessage(twice.db, [
      { handle: '+14155550101', total: 40, sent: 18, last: '2024-12-01' },
      { handle: 'nobody@example.com', total: 3, sent: 1, last: '2024-01-01' },
    ])
    expect(im.matched).toEqual(['Maya Chen'])
    expect(im.unmatched).toHaveLength(1)
    expect(im.db.interactions).toHaveLength(2)
  })
})

describe('logic', () => {
  it('computes cadence status', () => {
    const p = person({ cadenceDays: 30 })
    expect(statusOf(p, '2024-11-01', '2024-11-10')).toBe('ok')
    expect(statusOf(p, '2024-11-01', '2024-11-26')).toBe('due')
    expect(statusOf(p, '2024-11-01', '2024-12-01')).toBe('overdue')
    expect(statusOf(p, undefined, '2024-12-01')).toBe('overdue')
    expect(statusOf(person({}), undefined, '2024-12-01')).toBe('none')
  })

  it('handles birthdays across the year boundary', () => {
    expect(daysToBirthday('1990-01-02', '2024-12-30')).toBe(3)
    expect(daysToBirthday('12-30', '2024-12-30')).toBe(0)
  })

  it('ranks birthdays first, then the most overdue', () => {
    const db: Db = {
      people: [
        person({ id: 'a', name: 'A', cadenceDays: 30 }),
        person({ id: 'b', name: 'B', cadenceDays: 30 }),
        person({ id: 'c', name: 'C', birthday: '12-05' }),
        person({ id: 'd', name: 'D', cadenceDays: 30 }),
      ],
      interactions: [
        { id: '1', personId: 'a', date: '2024-10-20', channel: 'call', note: '' },
        { id: '2', personId: 'b', date: '2024-08-01', channel: 'call', note: '' },
        { id: '3', personId: 'd', date: '2024-11-28', channel: 'call', note: '' },
      ],
      reminders: [],
    }
    expect(suggestions(db, '2024-12-01').map((s) => s.person.name)).toEqual(['C', 'B', 'A'])
  })

  it('searches across the small things', () => {
    const p = person({ facts: ['Training for a marathon'], company: 'Acme' })
    expect(matchesQuery(p, 'marathon acme')).toBe(true)
    expect(matchesQuery(p, 'marathon globex')).toBe(false)
  })
})

import { suggestTier, tierHealth, withTier } from '../src/lib/logic'

describe('tiers', () => {
  const msg = (count: number) => ({ id: 'm', personId: 'p1', date: '2024-11-01', channel: 'imessage' as const, note: '', count })
  const logged = { id: 'l', personId: 'p1', date: '2024-11-01', channel: 'call' as const, note: '' }

  it('suggests a tier from existing signals', () => {
    expect(suggestTier(person({ circle: 'family' }), [])).toBe('inner')
    expect(suggestTier(person({}), [msg(250)])).toBe('inner')
    expect(suggestTier(person({}), [msg(40)])).toBe('warm')
    expect(suggestTier(person({ facts: ['Likes tea'] }), [])).toBe('warm')
    expect(suggestTier(person({}), [logged])).toBe('warm')
    expect(suggestTier(person({}), [msg(3)])).toBe('alive')
    expect(suggestTier(person({ circle: 'business', tags: ['linkedin'] }), [])).toBe('dormant')
  })

  it('sets the contact goal from the tier', () => {
    expect(withTier(person({ cadenceDays: 7 }), 'warm').cadenceDays).toBe(60)
    expect(withTier(person({ cadenceDays: 7 }), 'dormant').cadenceDays).toBeUndefined()
  })

  it('reports who is going cold per tier and surfaces important dates', () => {
    const db: Db = {
      people: [
        withTier(person({ id: 'a', name: 'A' }), 'inner'),
        withTier(person({ id: 'b', name: 'B', dates: [{ label: 'Anniversary', date: '12-04' }] }), 'inner'),
      ],
      interactions: [
        { id: '1', personId: 'a', date: '2024-10-01', channel: 'call', note: '' },
        { id: '2', personId: 'b', date: '2024-11-29', channel: 'call', note: '' },
      ],
      reminders: [],
    }
    expect(tierHealth(db, '2024-12-01')[0]).toMatchObject({ tier: 'inner', total: 2, overdue: 1 })
    const s = suggestions(db, '2024-12-01')
    expect(s[0]).toMatchObject({ kind: 'date', reason: 'Anniversary in 3 days' })
    expect(s[0].person.name).toBe('B')
  })
})

import { fillTemplate, templatesFor } from '../src/lib/logic'

describe('messages', () => {
  const base: Db = { people: [], interactions: [], reminders: [] }
  it('offers the matching template first, then general ones, then saved ones', () => {
    const p = person({ birthday: '12-03', circle: 'client' })
    const [s] = suggestions({ ...base, people: [p] }, '2024-12-01')
    const t = templatesFor(s, [{ id: 'mine', label: 'Mine', text: 'Yo {name}' }])
    expect(t.map((x) => x.id)).toEqual(['birthday', 'checkin', 'coffee', 'thinking', 'congrats', 'mine'])
    expect(fillTemplate(t[0], p)).toBe("Happy birthday, Maya! Hope it's a great one.")
    expect(fillTemplate(t[5], p)).toBe('Yo Maya')
  })
  it('hides a snoozed person until the snooze ends', () => {
    const p = person({ cadenceDays: 30, snoozeUntil: '2024-12-05' })
    expect(suggestions({ ...base, people: [p] }, '2024-12-01')).toHaveLength(0)
    expect(suggestions({ ...base, people: [p] }, '2024-12-05')).toHaveLength(1)
  })
})
