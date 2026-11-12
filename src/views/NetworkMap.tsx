import { useMemo, useState } from 'react'
import { useDb } from '../lib/store'
import { lastContactMap, statusOf, tierLabel, today } from '../lib/logic'
import type { Person } from '../lib/types'

type GroupBy = 'tier' | 'context' | 'company' | 'circle'
const MAX_GROUPS = 11
const MAX_DOTS = 90
const CELL_W = 300
const CELL_H = 260
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export default function NetworkMap({ open }: { open: (id: string) => void }) {
  const db = useDb()
  const [by, setBy] = useState<GroupBy>('tier')
  const now = today()
  const last = useMemo(() => lastContactMap(db), [db])

  const groups = useMemo(() => {
    const m = new Map<string, Person[]>()
    for (const p of db.people) {
      const k = (by === 'tier' ? tierLabel(p.tier) : by === 'context' ? p.context || p.company : p[by]) || 'Unsorted'
      m.set(k, [...(m.get(k) ?? []), p])
    }
    const sorted = [...m.entries()].sort((a, b) => b[1].length - a[1].length)
    const top = sorted.slice(0, MAX_GROUPS)
    const rest = sorted.slice(MAX_GROUPS).flatMap(([, ps]) => ps)
    if (rest.length) top.push(['Everything else', rest])
    return top
  }, [db.people, by])

  const cols = Math.min(4, Math.ceil(Math.sqrt(groups.length)))
  const rows = Math.ceil(groups.length / cols)

  return (
    <section>
      <div className="row between">
        <div className="row">
          <span className="muted">Group by</span>
          {(['tier', 'context', 'company', 'circle'] as GroupBy[]).map((g) => (
            <button key={g} className={by === g ? 'tab active' : 'tab'} onClick={() => setBy(g)}>
              {g === 'context' ? 'how you know them' : g}
            </button>
          ))}
        </div>
        <div className="row legend">
          <span><i className="dot ok" /> on track</span>
          <span><i className="dot due" /> due soon</span>
          <span><i className="dot overdue" /> overdue</span>
          <span><i className="dot none" /> no goal set</span>
        </div>
      </div>
      <svg className="map" viewBox={`0 0 ${cols * CELL_W} ${rows * CELL_H}`} role="img" aria-label="Network map">
        {groups.map(([name, people], gi) => {
          const cx = (gi % cols) * CELL_W + CELL_W / 2
          const cy = Math.floor(gi / cols) * CELL_H + CELL_H / 2 + 8
          const shown = people.slice(0, MAX_DOTS)
          const labelled = shown.length <= 6
          const spread = labelled ? 34 : 10
          return (
            <g key={name}>
              <circle className="halo" cx={cx} cy={cy} r={Math.min(108, spread * Math.sqrt(shown.length) + 22)} />
              <text className="group-label" x={cx} y={cy - CELL_H / 2 + 12} textAnchor="middle">
                {name.length > 30 ? name.slice(0, 29) + '…' : name} ({people.length})
              </text>
              {shown.map((p, i) => {
                const r = shown.length === 1 ? 0 : spread * Math.sqrt(i + 0.5)
                const x = cx + r * Math.cos(i * GOLDEN)
                const y = cy + r * Math.sin(i * GOLDEN)
                return (
                  <g key={p.id} className="node" onClick={() => open(p.id)}>
                    <title>{`${p.name}${p.title ? ', ' + p.title : ''}`}</title>
                    <circle className={`dot-svg ${statusOf(p, last.get(p.id), now)}`} cx={x} cy={y} r={labelled ? 9 : 6} />
                    {labelled && (
                      <text className="node-label" x={x} y={y + 22} textAnchor="middle">
                        {p.name.length > 16 ? p.name.split(' ')[0] : p.name}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <p className="muted">Click a dot to open that person. Hover for names in larger groups.</p>
    </section>
  )
}
