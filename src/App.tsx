import { useState } from 'react'
import { useDb, update, sampleDb } from './lib/store'
import Today from './views/Today'
import People from './views/People'
import PersonDetail from './views/PersonDetail'
import NetworkMap from './views/NetworkMap'
import Import from './views/Import'

type View = 'today' | 'people' | 'map' | 'import'
const TABS: { id: View; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'people', label: 'People' },
  { id: 'map', label: 'Map' },
  { id: 'import', label: 'Import' },
]

export default function App() {
  const db = useDb()
  const [view, setView] = useState<View>('today')
  const [personId, setPersonId] = useState<string | null>(null)
  const person = db.people.find((p) => p.id === personId)
  const go = (v: View) => {
    setPersonId(null)
    setView(v)
  }

  return (
    <div className="app">
      <header>
        <h1>
          <img src="/donkey.svg" alt="" width="28" height="28" />
          Donkey
        </h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={!person && view === t.id ? 'tab active' : 'tab'} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {person ? (
          <PersonDetail person={person} onBack={() => setPersonId(null)} />
        ) : db.people.length === 0 && view !== 'import' ? (
          <div className="empty">
            <h2>Nobody here yet</h2>
            <p>Import your contacts, or load sample data to look around.</p>
            <div className="row center">
              <button className="primary" onClick={() => go('import')}>
                Import contacts
              </button>
              <button onClick={() => update(() => sampleDb())}>Load sample data</button>
            </div>
          </div>
        ) : view === 'today' ? (
          <Today open={setPersonId} />
        ) : view === 'people' ? (
          <People open={setPersonId} />
        ) : view === 'map' ? (
          <NetworkMap open={setPersonId} />
        ) : (
          <Import />
        )}
      </main>
    </div>
  )
}
