import { useMemo } from 'react'
import { useDb, update } from '../lib/store'
import { suggestTiers, TIERS, withTier } from '../lib/logic'
import type { Tier } from '../lib/types'

const SHOWN = 100

export default function Sort({ open }: { open: (id: string) => void }) {
  const db = useDb()
  const sugg = useMemo(() => suggestTiers(db), [db])
  const unsorted = db.people.filter((p) => !p.tier)
  const count = (t: Tier, sorted: boolean) =>
    db.people.filter((p) => (sorted ? p.tier === t : !p.tier && sugg.get(p.id) === t)).length

  const setTier = (id: string, tier: Tier) =>
    update((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? withTier(p, tier) : p)) }))
  const acceptAll = () =>
    update((d) => ({ ...d, people: d.people.map((p) => (p.tier ? p : withTier(p, sugg.get(p.id) ?? 'dormant'))) }))

  return (
    <section>
      <div className="health">
        {TIERS.map((t) => (
          <div key={t.id} className="card stat">
            <span className="muted">
              {t.label} · {t.hint}
            </span>
            <b>{count(t.id, true)} people</b>
          </div>
        ))}
      </div>

      {unsorted.length === 0 ? (
        <p className="muted">Everyone is sorted. Change a tier any time from a person's page.</p>
      ) : (
        <>
          <div className="card row between">
            <span>
              <b>{unsorted.length} to sort.</b> Donkey's guess: {TIERS.map((t) => `${count(t.id, false)} ${t.label.toLowerCase()}`).join(', ')}.
            </span>
            <button className="primary" onClick={acceptAll}>
              Accept all suggestions
            </button>
          </div>
          <p className="muted">Guesses use family, message history, and your notes. The highlighted button is the suggestion; pick another to override.</p>
          <div className="table">
            {unsorted.slice(0, SHOWN).map((p) => (
              <div key={p.id} className="card row">
                <button className="link name" onClick={() => open(p.id)}>
                  {p.name}
                </button>
                <span className="muted">{[p.title, p.company].filter(Boolean).join(', ') || p.context || p.circle}</span>
                <span className="tiers">
                  {TIERS.map((t) => (
                    <button key={t.id} className={sugg.get(p.id) === t.id ? 'primary' : ''} onClick={() => setTier(p.id, t.id)}>
                      {t.label}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
          {unsorted.length > SHOWN && <p className="muted">Showing the first {SHOWN}. Sort these or accept all to continue.</p>}
        </>
      )}
    </section>
  )
}
