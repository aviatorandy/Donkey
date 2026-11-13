import { useState } from 'react'
import { useDb, update, uid } from '../lib/store'
import { addDays, TIERS, today, withTier } from '../lib/logic'
import type { Channel, Circle, Person, Tier } from '../lib/types'
import { CIRCLES } from './People'

const CHANNELS: Channel[] = ['imessage', 'whatsapp', 'linkedin', 'email', 'call', 'in-person', 'other']
const CADENCES: [string, number][] = [
  ['No nudges', 0],
  ['Weekly', 7],
  ['Every 2 weeks', 14],
  ['Monthly', 30],
  ['Every 2 months', 60],
  ['Quarterly', 90],
  ['Twice a year', 180],
  ['Yearly', 365],
]

const patch = (id: string, change: Partial<Person>) =>
  update((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...change } : p)) }))

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export default function PersonDetail({ person: p, onBack }: { person: Person; onBack: () => void }) {
  const db = useDb()
  const [fact, setFact] = useState('')
  const [note, setNote] = useState('')
  const [channel, setChannel] = useState<Channel>('imessage')
  const [date, setDate] = useState(today())
  const [rem, setRem] = useState('')
  const [remDue, setRemDue] = useState(addDays(today(), 7))
  const [dLabel, setDLabel] = useState('')
  const [dDate, setDDate] = useState('')
  const dates = p.dates ?? []
  const addDate = () => {
    if (!dLabel.trim() || !/^\d{2}-\d{2}$/.test(dDate)) return
    patch(p.id, { dates: [...dates, { label: dLabel.trim(), date: dDate }] })
    setDLabel('')
    setDDate('')
  }
  const set = (k: keyof Person) => (v: string) => patch(p.id, { [k]: v || undefined })
  const timeline = db.interactions.filter((i) => i.personId === p.id).sort((a, b) => b.date.localeCompare(a.date))
  const reminders = db.reminders.filter((r) => r.personId === p.id && !r.done)

  const addFact = () => {
    if (!fact.trim()) return
    patch(p.id, { facts: [...p.facts, fact.trim()] })
    setFact('')
  }
  const log = () => {
    update((d) => ({ ...d, interactions: [...d.interactions, { id: uid(), personId: p.id, date, channel, note: note.trim() }] }))
    setNote('')
  }
  const addRem = () => {
    if (!rem.trim()) return
    update((d) => ({ ...d, reminders: [...d.reminders, { id: uid(), personId: p.id, text: rem.trim(), due: remDue, done: false }] }))
    setRem('')
  }
  const remove = () => {
    if (!confirm(`Delete ${p.name} and their history?`)) return
    update((d) => ({
      ...d,
      people: d.people.filter((x) => x.id !== p.id),
      interactions: d.interactions.filter((x) => x.personId !== p.id),
      reminders: d.reminders.filter((x) => x.personId !== p.id),
    }))
    onBack()
  }

  return (
    <div>
      <div className="row between">
        <button onClick={onBack}>← Back</button>
        <button className="danger" onClick={remove}>
          Delete
        </button>
      </div>
      <input className="title-input" value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} aria-label="Name" />
      <div className="grid2">
        <section>
          <h2>The small things</h2>
          <div className="card">
            {p.facts.length === 0 && <p className="muted">Kids' names, what they're working on, how they take their coffee.</p>}
            <ul className="facts">
              {p.facts.map((f, i) => (
                <li key={i}>
                  <span className="grow">{f}</span>
                  <button className="link" aria-label={`Remove: ${f}`} onClick={() => patch(p.id, { facts: p.facts.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="row">
              <input className="grow" placeholder="Add something to remember" value={fact} onChange={(e) => setFact(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFact()} />
              <button onClick={addFact}>Add</button>
            </div>
          </div>

          <h2>History</h2>
          <div className="card">
            <div className="row">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
              <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} aria-label="Channel">
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="row">
              <input className="grow" placeholder="What did you talk about?" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && log()} />
              <button className="primary" onClick={log}>
                Log
              </button>
            </div>
          </div>
          {timeline.map((i) => (
            <div key={i.id} className="card row">
              <span className="muted nowrap">{i.date}</span>
              <span className="pill none">{i.channel}</span>
              <span className="grow">{i.note}</span>
              <button className="link" aria-label="Remove entry" onClick={() => update((d) => ({ ...d, interactions: d.interactions.filter((x) => x.id !== i.id) }))}>
                ×
              </button>
            </div>
          ))}
        </section>

        <section>
          <h2>Details</h2>
          <div className="card fields">
            <label className="field">
              <span>Tier</span>
              <select
                value={p.tier ?? ''}
                onChange={(e) => patch(p.id, e.target.value ? withTier(p, e.target.value as Tier) : { tier: undefined })}
              >
                <option value="">Not sorted yet</option>
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.hint})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Circle</span>
              <select value={p.circle} onChange={(e) => patch(p.id, { circle: e.target.value as Circle })}>
                {CIRCLES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Keep in touch</span>
              <select value={p.cadenceDays ?? 0} onChange={(e) => patch(p.id, { cadenceDays: Number(e.target.value) || undefined })}>
                {CADENCES.map(([l, v]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Company" value={p.company} onChange={set('company')} />
            <Field label="Title" value={p.title} onChange={set('title')} />
            <Field label="How you know them" value={p.context} onChange={set('context')} placeholder="e.g. Northwind 2019-2022" />
            <Field label="Phone" value={p.phone} onChange={set('phone')} placeholder="+1..." />
            <Field label="Email" value={p.email} onChange={set('email')} />
            <Field label="LinkedIn URL" value={p.linkedin} onChange={set('linkedin')} />
            <Field label="Birthday" value={p.birthday} onChange={set('birthday')} placeholder="MM-DD or YYYY-MM-DD" />
            <Field
              label="Tags (comma separated)"
              value={p.tags.join(', ')}
              onChange={(v) => patch(p.id, { tags: v.split(',').map((t) => t.trimStart()).filter((t, i, a) => t || i === a.length - 1) })}
            />
          </div>

          <h2>Important dates</h2>
          <div className="card">
            {dates.length === 0 && <p className="muted">Anniversaries, kids' birthdays, anything you should not miss.</p>}
            {dates.map((d, i) => (
              <div key={i} className="row">
                <span className="grow">{d.label}</span>
                <span className="muted">{d.date}</span>
                <button className="link" aria-label={`Remove: ${d.label}`} onClick={() => patch(p.id, { dates: dates.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <div className="row">
              <input className="grow" placeholder="e.g. Anniversary" value={dLabel} onChange={(e) => setDLabel(e.target.value)} />
              <input className="short" placeholder="MM-DD" value={dDate} onChange={(e) => setDDate(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDate()} aria-label="Date as MM-DD" />
              <button onClick={addDate}>Add</button>
            </div>
          </div>

          <h2>Reminders</h2>
          <div className="card">
            {reminders.map((r) => (
              <label key={r.id} className="row reminder">
                <input type="checkbox" onChange={() => update((d) => ({ ...d, reminders: d.reminders.map((x) => (x.id === r.id ? { ...x, done: true } : x)) }))} />
                <span className="grow">{r.text}</span>
                <span className="muted">{r.due}</span>
              </label>
            ))}
            <div className="row">
              <input className="grow" placeholder="Remind me to..." value={rem} onChange={(e) => setRem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRem()} />
              <input type="date" value={remDue} onChange={(e) => setRemDue(e.target.value)} aria-label="Due date" />
              <button onClick={addRem}>Add</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
