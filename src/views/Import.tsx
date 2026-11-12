import { useState, type ChangeEvent } from 'react'
import { getDb, update, useDb } from '../lib/store'
import { applyIMessage, applyWhatsApp, mergePeople, parseLinkedIn, parseVCard, parseWhatsApp, type ChatSummary, type IMessageRow } from '../lib/importers'
import { emptyDb, type Db } from '../lib/types'

const SCRIPT_CMD = 'python3 scripts/export_imessage.py > imessage.json'

function FileButton({ accept, onText }: { accept: string; onText: (text: string, name: string) => void }) {
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onText(await f.text(), f.name)
  }
  return <input type="file" accept={accept} onChange={pick} />
}

export default function Import() {
  const db = useDb()
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [wa, setWa] = useState<ChatSummary[] | null>(null)
  const say = (k: string, v: string) => setMsg((m) => ({ ...m, [k]: v }))
  const attempt = (k: string, fn: () => string) => {
    try {
      say(k, fn())
    } catch (e) {
      say(k, `Could not import: ${(e as Error).message}`)
    }
  }

  const people = (k: string, parse: (t: string) => ReturnType<typeof parseVCard>) => (text: string) =>
    attempt(k, () => {
      const r = mergePeople(getDb(), parse(text))
      update(() => r.db)
      return `Added ${r.added}, updated ${r.updated}.`
    })

  const finishWa = (me: string) => {
    if (!wa) return
    const r = applyWhatsApp(getDb(), wa, me)
    update(() => r.db)
    setWa(null)
    say('wa', `Updated ${r.matched.join(', ') || 'nobody'}.` + (r.unmatched.length ? ` No contact found for: ${r.unmatched.join(', ')}. Add them first, then re-import.` : ''))
  }

  const imessage = (text: string) =>
    attempt('im', () => {
      const rows = JSON.parse(text) as IMessageRow[]
      if (!Array.isArray(rows) || (rows[0] && !rows[0].handle)) throw new Error('expected the JSON written by export_imessage.py')
      const r = applyIMessage(getDb(), rows)
      update(() => r.db)
      const top = r.unmatched.slice(0, 5).map((u) => `${u.handle} (${u.total})`).join(', ')
      return `Updated last-contact for ${r.matched.length} people.` + (top ? ` Busiest threads with no matching contact: ${top}.` : '')
    })

  const backup = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }))
    a.download = 'donkey-backup.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const restore = (text: string) =>
    attempt('backup', () => {
      const d = JSON.parse(text) as Db
      if (!Array.isArray(d.people)) throw new Error('not a Donkey backup')
      if (db.people.length && !confirm('Replace everything currently in Donkey with this backup?')) return 'Cancelled.'
      update(() => ({ ...emptyDb, ...d }))
      return `Restored ${d.people.length} people.`
    })

  return (
    <div className="grid2">
      <section>
        <h2>People</h2>
        <div className="card">
          <h3>Phone contacts (.vcf)</h3>
          <p className="muted">Contacts app → select all → File → Export → Export vCard. Brings in names, numbers, and birthdays.</p>
          <FileButton accept=".vcf,text/vcard" onText={people('vcf', parseVCard)} />
          <p>{msg.vcf}</p>
        </div>
        <div className="card">
          <h3>LinkedIn connections (.csv)</h3>
          <p className="muted">LinkedIn → Settings → Data privacy → Get a copy of your data → Connections. Upload Connections.csv.</p>
          <FileButton accept=".csv,text/csv" onText={people('li', parseLinkedIn)} />
          <p>{msg.li}</p>
        </div>
        <div className="card">
          <h3>Backup</h3>
          <p className="muted">Everything lives in this browser only. Download a backup to move devices.</p>
          <div className="row">
            <button onClick={backup}>Download backup</button>
            <FileButton accept=".json,application/json" onText={restore} />
          </div>
          <p>{msg.backup}</p>
        </div>
      </section>
      <section>
        <h2>Message history</h2>
        <p className="muted">These update "last contact" for people you already have. Message text is never stored.</p>
        <div className="card">
          <h3>WhatsApp chat export (.txt)</h3>
          <p className="muted">Open a chat → contact name → Export chat → Without media.</p>
          <FileButton accept=".txt,text/plain" onText={(t) => attempt('wa', () => {
            const chats = parseWhatsApp(t)
            if (!chats.length) throw new Error('no WhatsApp messages found in that file')
            setWa(chats)
            return ''
          })} />
          {wa && (
            <div className="row">
              <span>Which one is you?</span>
              {wa.map((c) => (
                <button key={c.sender} onClick={() => finishWa(c.sender)}>
                  {c.sender}
                </button>
              ))}
            </div>
          )}
          <p>{msg.wa}</p>
        </div>
        <div className="card">
          <h3>iMessage (Mac only)</h3>
          <p className="muted">
            Run this in Terminal from the project folder, then upload imessage.json. Terminal needs Full Disk Access (System Settings → Privacy &amp; Security).
          </p>
          <pre>{SCRIPT_CMD}</pre>
          <FileButton accept=".json,application/json" onText={imessage} />
          <p>{msg.im}</p>
        </div>
      </section>
    </div>
  )
}
