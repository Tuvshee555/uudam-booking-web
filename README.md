# Uudam Travel Agency — website + admin

Storefront, admin panel and API in **one Next.js 16 app**, deployable as a
single Vercel project.

## Database Consolidation Audit

`npm run db:audit-merge` compares this website's configured `DATABASE_URL` with
the sibling `Uudam-Chatbot` database. It uses PostgreSQL read-only transactions,
inventories every user table and reports counts, schema differences and row
fingerprint comparisons. Customer records and connection URLs are not printed.
There is no apply mode. A missing source connection produces an incomplete
report and exit code 2, while still inventorying the available target.

Existing env files can be selected with `--source-env PATH` and
`--target-env PATH`. `BOOKING_SOURCE_DATABASE_URL` and
`CHATBOT_TARGET_DATABASE_URL` can also provide connections. Keep credentials
in ignored env files. Fingerprints are preliminary comparisons, not backups.
Trip links, unique-key conflicts, backups and the copy plan must be reviewed
before migration. Run the audit tests with
`node --test tests/audit-database-merge.test.mjs`.

Cloned from the three-project food-delivery stack and re-modelled around a
travel agency that **sells manually**. No git remote is configured — run
`git init` and connect it when ready.

---

## The one thing that shapes everything

Nobody buys on this site. The agency closes on the phone and in Messenger, so
the website is a **catalogue plus lead capture**:

> visitor reads a trip → leaves name + phone + date + headcount → staff ring back

There is therefore **no cart, no checkout, no payment gateway and no customer
account** anywhere in this codebase. That is deliberate, not unfinished. The
only conversion event is an `Enquiry`.

Consequences worth knowing before you extend it:

- The dashboard reports **enquiries, not revenue**. Money moves off-site, so any
  revenue figure this app displayed would be invented.
- Seat counts on departures are **maintained by staff**, not decremented
  automatically — the app never learns that a seat was actually sold.
- The estimate shown next to the enquiry form is labelled as an estimate in the
  UI and in the confirmation email. Staff quote the real number.

---

## Why one app instead of three

The original stack was an Express API on Render plus two separate Next apps.

| Before | Now |
| --- | --- |
| Render free tier slept — first visitor of the day waited ~50s | Vercel functions, no cold API |
| CORS allow-list across three origins | Same origin, no CORS |
| Three deploys, three env var sets | One deploy, one env set |
| Types duplicated between admin and storefront | Shared `src/types/trip.ts` |

Serverless adaptations that were needed: uploads over 4.5MB (i.e. every trip
video) go browser → Cloudinary directly via a signed request
(`/api/upload/signature`); `bcryptjs` replaces native `bcrypt`; post-response
work uses Next's `after()` rather than `setImmediate`.

---

## Domain model

- **Trip** — title, slug, rich description, country/city/destinations, coords &
  map, duration, difficulty, transport, languages, highlights,
  included/excluded, requirements, cancellation policy, cover image, extra
  images, **video + videos**, adult/child/infant fares, single supplement.
- **Departure** — a dated instance with seats and an optional price override.
  Replaces the old food "size" concept.
- **ItineraryDay** — day-by-day programme with location, meals, accommodation.
- **Category** — nested tree, now holding trips.
- **Enquiry** — the lead. Trip + date + headcount + contact + staff notes +
  status (`NEW → CONTACTED → CONFIRMED → COMPLETED`, or `CANCELLED`).
- **Testimonial** — customer feedback entered by staff (there are no customer
  accounts, so these can't be self-service reviews).
- **User** — staff only.

---

## First run

```bash
npm install                 # runs prisma generate
cp .env.example .env        # only DATABASE_URL + NEXT_PUBLIC_SITE_URL really change
npx prisma migrate deploy
node prisma/seed.mjs        # optional: demo categories, 4 trips, an admin user
npm run dev
```

Seed data is data only — no code reads those trip names, prices or dates, so
every seeded row can be deleted without breaking anything.

## Admin access

Two layers, deliberately:

1. `src/proxy.ts` checks a `token` cookie to decide whether `/admin/*` renders
   at all. `AuthProvider` writes that cookie client-side, so it is only a hint —
   it stops a stranger seeing the shell, nothing more.
2. Every admin API route calls `requireAdmin()`, which verifies the JWT **and
   re-reads the role from the database** (15s cache). That is the real gate; a
   forged cookie earns an empty screen and a 403.

Create an admin by running the seed, or promote an existing row:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = '...';
```

Then sign in at `/mn/admin/log-in`. Staff use email + password.

Admin screens: **dashboard** (new enquiries, this week/month, upcoming
departures, most-asked-about trips), **enquiries** (filter by status, search,
one-tap status change, tap-to-call), **trips** (publish / unpublish / feature),
**analytics** (see below).

## Analytics

First-party, in Postgres. No Google Analytics, no third-party script, nothing
personally identifying — `visitorId` is a random id the browser generates for
itself and stores locally; no IP address is ever written down.

`/admin/analytics` answers:

- how many **unique visitors** and total views, with the trend against the
  previous equal-length window
- **per trip**: visitors, views, average time on page, video plays, enquiries,
  and **conversion rate** — the last column is the one worth acting on, since it
  says how many people looked for every one who actually called
- **where they came from** (referrer host) and on what device
- **who messaged from which trip**, with each lead's referrer

How it works: `PageTracker` is mounted once site-wide and opens a view on mount,
then closes it out with time-on-page using `navigator.sendBeacon` when the tab
goes away. Two details that matter if you touch it:

- The trip is resolved **server-side from the path**, not sent by the client, so
  a single tracker covers the whole site without trip pages double-counting.
- `sendBeacon` can only issue a POST, so `POST /api/track` treats a body
  carrying a `viewId` as a close-out rather than a new view. Remove that branch
  and every visit is counted twice.

Bots, and anything under `/admin`, are dropped server-side. Time on page is
capped at 30 minutes so one tab left open overnight can't distort the averages.

`TripView` rows are stored raw rather than pre-aggregated — cheaper at an
agency's traffic and it keeps every question askable after the fact. If it ever
passes a few million rows, add a daily rollup.

## Verified

```
npx tsc --noEmit   → 0 errors
npx eslint src     → 0 problems
npx next build     → compiles clean
```

---

## Layout

```
src/
  app/
    [locale]/            storefront (mn | en | ko, default mn)
      trips/             list + /[slug] detail with enquiry panel
      category/[id]/     browse, includes descendant categories
      about/ contact/ terms/
      admin/             log-in, dashboard, enquiries, trips
    api/                 the whole backend
  server/                API-side logic: auth, prisma, mail, trip input…
  components/
    layout/              header, footer
    trip/                TripCard, TripMedia (photos + video), EnquiryPanel
    admin/               AdminShell, status badge
    ui/                  shadcn primitives
  lib/
    contact.ts           ← agency phone / Facebook / Messenger live here
    pricing.ts           fare math, shared by client AND server
  types/trip.ts          shared domain types
prisma/                  schema, init migration, seed
```

`src/lib/pricing.ts` is shared on purpose: the server recomputes the estimate
from the database when an enquiry arrives, and if the client used different
rules staff would see a different number than the customer did.

---

## Database Consolidation

The consolidation tooling copies website tables additively into the chatbot
database. It refuses existing table/type names, preserves every column value,
and verifies the copy with server-side multiset comparisons before committing.
PostgreSQL 18 NOT NULL catalog entries are represented by equivalent column
requirements on PostgreSQL 17.

Use `scripts/consolidate-databases.mjs` with `--prepare`, `--apply`, or `--verify`
and a fresh `--directory tmp/<name>`. Connection files and full backups contain
secrets or customer data: keep them ignored and never commit them. Create
managed snapshots of both databases before live work. Rehearse on a disposable
branch first. `--freeze-source` pauses writes without deleting records;
`--unfreeze-source` restores writes if the cutover must be rolled back.

After a successful cutover, booking `DATABASE_URL` and `DIRECT_URL`, and chatbot
`NEON_DATABASE_URL` and `BOOKING_DATABASE_URL`, must identify the same chatbot
database. Do not run schema-reset or destructive Prisma synchronization commands
against that shared database. Keep the original website database as a read-only
archive rather than deleting it.

`scripts/verify-consolidated-website.mjs --baseline-url <url>` captures public
content, page availability, and admin guards; `--compare-url <url>` compares
against it. Both take the same ignored `--directory tmp/<name>`.

## Brand

From the logo (`public/uudam-logo.jpg`):

- **Navy `#113e67`** — `hsl(209 72% 24%)`. Header rail, buttons, prices.
- **Gold `#f2bd4a`** — `hsl(41 87% 62%)`, the sun in the mark. Sparingly:
  the call button, badges, the eyebrow label, the top loading bar.
- Everything else white. Roughly 90 / 8 / 2 white / navy / gold — the logo's
  navy field is heavy, so it appears at full strength only in the header and
  the hero.

Tokens in `src/app/globals.css`; Tailwind exposes `navy`, `navy-soft`,
`navy-deep`, `gold`.

Font is **Manrope** with the `cyrillic-ext` subset — required, not optional: Ө
and Ү live there, and without it the browser swaps faces mid-word.

---

## Not done yet

- **Trip create/edit form.** The API is complete (create/update with itinerary
  and departures, Cloudinary signing, `?all=true` draft list), but the admin
  form is not built — trips are currently added through Prisma Studio or SQL.
  This is the main remaining gap.
- **Testimonials admin.** The model exists and the trip page reads published
  ones; there is no screen to enter them yet.
- **Analytics retention.** Nothing prunes `TripView` yet. Add a scheduled
  delete (say, older than 12 months) before the table gets large.
- **Locale files.** `src/messages/{mn,en,ko}.json` still hold food-delivery
  copy and are unused — the storefront writes Mongolian directly. Either
  translate them and switch components to `t()`, or drop the locale segment to
  `mn` only.
- `_admin_src/` and `_backend_src/` are staging copies of the original
  food-delivery projects, excluded from TypeScript and ESLint. Delete them once
  the trip form is ported.
