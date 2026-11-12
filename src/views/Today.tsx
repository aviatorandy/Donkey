import { useState } from 'react'
import { useDb, update, uid } from '../lib/store'
import { addDays, daysBetween, draftMessage, sendLinks, suggestions, today, type Suggestion } from '../lib/logic'
import type { Channel } from '../lib/types'

const CHANNEL_FOR: Record<string, Channel> = { iMessage: 'imessage', WhatsApp: 'whatsapp', LinkedIn: 'linkedin', Email: 'email' }

export function logContact(personId: string, channel: Channel, note: string) {
  update((d) => ({
    ...d,
    interactions: [...d.interactions, { id: uid(), personId, date: today(), channel, note }],
  }))
}

function SuggestionCard({ s, open }: { s: Suggestion; open: (id: string) => void }) {
  const [text, setText] = useState(() => draftMessage(s))
  const p = s.person
  const links = sendLinks(p, text)
  return (
    <div className="card">
      <div className="row between">
        <button className="link name" onClick={() => open(p.id)}>
          {p.name}
        </button>
        <span className={`pill ${s.kind === 'birthday' ? 'due' : 'overdue'}`}>{s.reason}</span>
      </div>
      {p.facts.length > 0 && <p className="muted">Remember: {p.facts.slice(0, 2).join(' · ')}</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label={`Draft message to ${p.name}`} />
      <div className="row">
        {links.map((l) => (
          <a
            key={l.label}
            className="btn"
            href={l.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => logContact(p.id, CHANNEL_FOR[l.label] ?? 'other', `Sent: ${text}`)}
          >
            {l.label}
          </a>
        ))}
        <button onClick={() => logContact(p.id, 'other', 'Caught up')}>Mark as done</button>
        {links.length === 0 && <span className="muted">Add a phone, email, or LinkedIn URL to send from here.</span>}
      </div>
    </div>
  )
}

export default function Today({ open }: { open: (id: string) => void }) {
  const db = useDb()
  const now = today()
  const sugg = suggestions(db, now)
  const reminders = db.reminders.filter((r) => !r.done).sort((a, b) => a.due.localeCompare(b.due))
  const [text, setText] = useState('')
  const [due, setDue] = useState(addDays(now, 7))
  const [who, setWho] = useState('')

  const add = () => {
    if (!text.trim()) return
    update((d) => ({
      ...d,
      reminders: [...d.reminders, { id: uid(), text: text.trim(), due, personId: who || undefined, done: false }],
    }))
    setText('')
  }

  return (
    <div className="grid2">
      <section>
        <h2>Reach out ({sugg.length})</h2>
        {sugg.length === 0 && <p className="muted">You're caught up. Set a "keep in touch" goal on a person to get nudges.</p>}
        {sugg.slice(0, 12).map((s) => (
          <SuggestionCard key={`${s.person.id}-${s.kind}`} s={s} open={open} />
        ))}
      </section>
      <section>
        <h2>Reminders ({reminders.length})</h2>
        <div className="card">
          <input placeholder="Remind me to..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <div className="row">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person">
              <option value="">No person</option>
              {db.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="primary" onClick={add}>
              Add
            </button>
          </div>
        </div>
        {reminders.map((r) => {
          const p = db.people.find((x) => x.id === r.personId)
          const d = daysBetween(now, r.due)
          return (
            <label key={r.id} className="card row reminder">
              <input
                type="checkbox"
                onChange={() => update((db) => ({ ...db, reminders: db.reminders.map((x) => (x.id === r.id ? { ...x, done: true } : x)) }))}
              />
              <span className="grow">
                {r.text}
                {p && (
                  <>
                    {' · '}
                    <button className="link" onClick={() => open(p.id)}>
                      {p.name}
                    </button>
                  </>
                )}
              </span>
              <span className={`pill ${d < 0 ? 'overdue' : d <= 2 ? 'due' : 'none'}`}>
                {d < 0 ? `${-d}d late` : d === 0 ? 'today' : `in ${d}d`}
              </span>
            </label>
          )
        })}
      </section>
    </div>
  )
}
