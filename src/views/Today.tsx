import { useState } from 'react'
import { useDb, update, uid } from '../lib/store'
import { addDays, daysBetween, fillTemplate, firstName, sendLinks, suggestions, templatesFor, tierHealth, today, type Suggestion } from '../lib/logic'
import type { Channel } from '../lib/types'

const CHANNEL_FOR: Record<string, Channel> = { iMessage: 'imessage', WhatsApp: 'whatsapp', LinkedIn: 'linkedin', Email: 'email' }

export function logContact(personId: string, channel: Channel, note: string) {
  update((d) => ({
    ...d,
    interactions: [...d.interactions, { id: uid(), personId, date: today(), channel, note }],
  }))
}

function SuggestionCard({ s, open }: { s: Suggestion; open: (id: string) => void }) {
  const db = useDb()
  const p = s.person
  const templates = templatesFor(s, db.templates)
  const [composing, setComposing] = useState(false)
  const [picked, setPicked] = useState(templates[0].id)
  const [text, setText] = useState(() => fillTemplate(templates[0], p))
  const links = sendLinks(p, text)

  // A catch-up nudge clears once contact is logged. A date nudge is hidden until the date has passed.
  const clear = (channel: Channel | null, note: string) =>
    update((d) => ({
      ...d,
      interactions: channel ? [...d.interactions, { id: uid(), personId: p.id, date: today(), channel, note }] : d.interactions,
      people: s.inDays === undefined ? d.people : d.people.map((x) => (x.id === p.id ? { ...x, snoozeUntil: addDays(today(), s.inDays! + 1) } : x)),
    }))
  const later = () => update((d) => ({ ...d, people: d.people.map((x) => (x.id === p.id ? { ...x, snoozeUntil: addDays(today(), 7) } : x)) }))
  const send = (label: string) => {
    // LinkedIn cannot be pre-filled, so the draft goes to the clipboard to paste.
    if (label === 'LinkedIn') navigator.clipboard?.writeText(text).catch(() => {})
    clear(CHANNEL_FOR[label] ?? 'other', `Sent: ${text}`)
  }
  const saveTemplate = () => {
    const label = prompt('Name this template')?.trim()
    if (!label) return
    const reusable = text.split(firstName(p)).join('{name}')
    update((d) => ({ ...d, templates: [...(d.templates ?? []), { id: uid(), label, text: reusable }] }))
  }

  return (
    <div className="card">
      <div className="row between">
        <button className="link name" onClick={() => open(p.id)}>
          {p.name}
        </button>
        <span className={`pill ${s.kind === 'catch-up' ? 'overdue' : 'due'}`}>{s.reason}</span>
      </div>
      {p.facts.length > 0 && <p className="muted">Remember: {p.facts.slice(0, 2).join(' · ')}</p>}

      {!composing ? (
        <div className="row">
          <button className="primary" onClick={() => setComposing(true)}>
            Message
          </button>
          <button onClick={() => clear('other', 'Caught up')}>Done</button>
          <button className="quiet" onClick={later}>
            Later
          </button>
        </div>
      ) : (
        <div className="composer">
          <div className="chips">
            {templates.map((t) => (
              <button
                key={t.id}
                className={picked === t.id ? 'chip on' : 'chip'}
                onClick={() => {
                  setPicked(t.id)
                  setText(fillTemplate(t, p))
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label={`Message to ${p.name}`} />
          <div className="row">
            {links.map((l, i) => (
              <a key={l.label} className={i === 0 ? 'btn primary' : 'btn'} href={l.href} target="_blank" rel="noreferrer" onClick={() => send(l.label)}>
                {i === 0 ? `Send with ${l.label}` : l.label}
              </a>
            ))}
            {links.length === 0 && <span className="muted">Add a phone, email, or LinkedIn URL to send from here.</span>}
            <button className="quiet" onClick={() => setComposing(false)}>
              Cancel
            </button>
            <button className="quiet right" onClick={saveTemplate}>
              Save as template
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function QuickCapture() {
  const db = useDb()
  const [who, setWho] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState('')
  const person = db.people.find((p) => p.name.toLowerCase() === who.trim().toLowerCase())
  const save = (remember: boolean) => {
    if (!person || !note.trim()) return
    const text = note.trim()
    update((d) => ({
      ...d,
      interactions: [...d.interactions, { id: uid(), personId: person.id, date: today(), channel: 'other', note: text }],
      people: remember ? d.people.map((p) => (p.id === person.id ? { ...p, facts: [...p.facts, text] } : p)) : d.people,
    }))
    setSaved(`Saved for ${person.name}.`)
    setNote('')
    setWho('')
  }
  return (
    <div className="card">
      <div className="row">
        <input className="short-name" list="people-names" placeholder="Who?" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Person" />
        <datalist id="people-names">
          {db.people.slice(0, 500).map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <input className="grow" placeholder="What did you learn?" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save(true)} aria-label="Note" />
      </div>
      <div className="row">
        <button className="primary" disabled={!person || !note.trim()} onClick={() => save(true)}>
          Log and remember
        </button>
        <button disabled={!person || !note.trim()} onClick={() => save(false)}>
          Log only
        </button>
        <span className="muted">{saved}</span>
      </div>
    </div>
  )
}

export default function Today({ open, goSort }: { open: (id: string) => void; goSort: () => void }) {
  const db = useDb()
  const now = today()
  const sugg = suggestions(db, now)
  const health = tierHealth(db, now)
  const unsorted = db.people.filter((p) => !p.tier).length
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
    <>
      <p className="greet">
        {greeting()}. {sugg.length === 0 ? "You're all caught up." : `${sugg.length} ${sugg.length === 1 ? 'person' : 'people'} to reach out to.`}
      </p>
      <div className="health">
        {health.map((h) => (
          <div key={h.tier} className="card stat">
            <span className="muted">{h.label}</span>
            <b>{h.total === 0 ? 'Nobody yet' : h.overdue === 0 ? `All ${h.total} on track` : `${h.overdue} of ${h.total} going cold`}</b>
          </div>
        ))}
        {unsorted > 0 && (
          <button className="card stat sortcta" onClick={goSort}>
            <span className="muted">Not sorted yet</span>
            <b>Sort {unsorted} {unsorted === 1 ? 'person' : 'people'} →</b>
          </button>
        )}
      </div>
    <div className="grid2">
      <section>
        <QuickCapture />
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
    </>
  )
}
