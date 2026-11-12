# Donkey

A personal CRM for friends and business contacts: the small things worth remembering, who you are overdue to talk to, and a map of your network.

## Run it

```bash
npm install
npm run dev
```

`npm test` runs the importer and suggestion tests. `npm run build` produces a static site in `dist/`.

## What it does

- **Landing page** at `/` with an early-access form. Set `VITE_SIGNUP_ENDPOINT` (see `.env.example`) to collect sign-ups. The app is at `/app/`.
- **Today**: who to reach out to (birthdays, then most overdue against the goal you set), with an editable draft that opens in iMessage, WhatsApp, or email. Plus reminders.
- **People**: search across names, companies, tags, and notes. Filter by circle (friend, family, business, client) or by chapter (a company or "how you know them").
- **Map**: everyone grouped by chapter, company, or circle, coloured by whether you are on track.
- **Import**: phone contacts (.vcf), LinkedIn `Connections.csv`, WhatsApp chat exports, and iMessage history via `scripts/export_imessage.py` (Mac).

## Limits

- Data lives in your browser's local storage. Use Import → Download backup to move it.
- Imports are manual. iMessage, personal WhatsApp, and LinkedIn do not offer a sync API.
- Messages are drafted, never sent automatically. You tap send.
- Message imports record counts and the latest date only, never message text.
