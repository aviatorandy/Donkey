import { useMemo, useState } from 'react'
import { useDb, update, uid } from '../lib/store'
import { daysBetween, lastContactMap, matchesQuery, statusOf, tierLabel, TIERS, today } from '../lib/logic'
import type { Circle } from '../lib/types'

export const CIRCLES: Circle[] = ['friend', 'family', 'business', 'client']

export default function People({ open }: { open: (id: string) => void }) {
  const db = useDb()
  const [q, setQ] = useState('')
  const [circle, setCircle] = useState<Circle | ''>('')
  const [group, setGroup] = useState('')
  const [tier, setTier] = useState('')
  const now = today()
  const last = useMemo(() => lastContactMap(db), [db])

  // "Chapters" are companies and how-you-know-them contexts: the way to browse a career.
  const chapters = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of db.people)
      for (const k of new Set([p.context, p.company])) if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [db.people])

  const rows = db.people
    .filter((p) => (!tier || (p.tier ?? 'none') === tier) && (!circle || p.circle === circle) && (!group || p.company === group || p.context === group) && matchesQuery(p, q))
    .sort((a, b) => a.name.localeCompare(b.name))

  const add = () => {
    const id = uid()
    update((d) => ({ ...d, people: [...d.people, { id, name: q.trim() || 'New person', circle: circle || 'friend', tags: [], facts: [] }] }))
    open(id)
  }

  return (
    <section>
      <div className="row">
        <input className="grow" placeholder="Search names, companies, tags, and the small things..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Tier">
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          <option value="none">Unsorted</option>
        </select>
        <select value={circle} onChange={(e) => setCircle(e.target.value as Circle | '')} aria-label="Circle">
          <option value="">All circles</option>
          {CIRCLES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Chapter">
          <option value="">All chapters</option>
          {chapters.map(([k, n]) => (
            <option key={k} value={k}>
              {k} ({n})
            </option>
          ))}
        </select>
        <button className="primary" onClick={add}>
          Add person
        </button>
      </div>
      <p className="muted">{rows.length} of {db.people.length} people</p>
      <div className="table">
        {rows.slice(0, 300).map((p) => {
          const l = last.get(p.id)
          const st = statusOf(p, l, now)
          return (
            <button key={p.id} className="tr" onClick={() => open(p.id)}>
              <span className={`dot ${st}`} />
              <span className="name">{p.name}</span>
              <span className="muted">{[p.title, p.company].filter(Boolean).join(', ') || p.context || ''}</span>
              <span className="pill none">{tierLabel(p.tier)}</span>
              <span className="muted right">{l ? `${daysBetween(l, now)}d ago` : 'no contact logged'}</span>
            </button>
          )
        })}
        {rows.length > 300 && <p className="muted">Showing the first 300. Narrow the search to see the rest.</p>}
      </div>
    </section>
  )
}
