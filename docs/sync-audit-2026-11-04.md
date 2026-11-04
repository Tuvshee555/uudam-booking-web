# Website ↔ Messenger chatbot: sync audit and fixes (2026-11-04)

Follow-up to `docs/qa-report-2026-11-04.md` (the admin editor, the on-site
advisor). This report covers the Messenger chatbot (`Tuvshee555/Uudam-Chatbot`),
the shared database, every linked trip, and what is and is not in production.

Nothing in the live database was written during this work. Every edit was made
on a local copy of the catalogue (no customer data) with a local chatbot; no
message was sent to a real customer; no deployment was triggered by hand.

## 1. Was the Messenger chatbot fixed? Which files?

Yes, for the part that broke the website → chatbot sync. The chatbot's own
conversation logic was not rebuilt. Changes are on branch
`claude/website-sync-schedule-fares` of `Uudam-Chatbot` (commit `b76ce8f`,
preview deployment built and READY, **not** on `main`, so **not in
production**).

| File | Change |
| --- | --- |
| `src/lib/websiteTripBridge.ts` | Schedules are compared as calendar days, not strings. The chatbot keeps its dates as Mongolian text ("10 сарын 8"); the website sends days. The old string comparison meant a day added on the website never reached the bot, and an unchanged schedule could register as a change or a conflict. Past days no longer count. The chatbot's wording is kept for days that did not change. A weekly rule ("Пүрэв гараг бүр") is reported back as `recurring_schedule` instead of being overwritten or turned into a conflict. The per-date fare merge now runs whenever the website sends a fare table (before, only when the chatbot already had one), a save that changes no fare is neither a conflict nor "ignored", and a real fare edit lands even when an unrelated older conflict is still open. |
| `src/lib/travelSchema.ts` | Three `ALTER TABLE travel_senders` statements ran before the `CREATE TABLE`, so a fresh database could not initialise (found when bringing up the local chatbot). Reordered. |
| `tests/website-trip-schedule-sync.test.ts` | 9 cases: text-vs-days is not a change; added/removed day reaches the bot; no stored resolution; weekly rule → `recurring_schedule`; both sides changed → one conflict stated in days; past day ignored; relabelled/reordered fare table beside an old conflict → nothing ignored; real fare edit applies beside an unrelated conflict. |
| `tests/website-fare-edit-journey.test.ts` | Through the real webhook harness: a customer asks a date's fare, the website raises that date's fare, the bridge applies it, the next customer hears the new fare and the other date keeps its fare. |
| `docs/connected-trips.md` | Describes the day-based comparison and the `recurring_schedule` reason. |

Chatbot gates after the change: `npm run typecheck` clean; `npm test` 1698 pass,
0 fail (1 pre-existing todo); `npm run qa:conversations` 136/136; lint 0 errors.

Website side (this repository, branch `claude/optimistic-maxwell-j5w7em`):

| File | Change |
| --- | --- |
| `src/lib/tripSyncStatus.ts` | Plain-language text for the new `recurring_schedule` reason, so the editor explains why a date change was not taken instead of showing a code. |
| `src/components/admin/trip-form/TripComparison.tsx`, `src/app/api/admin/trip-parity/route.ts` | The "Chatbot-той харьцуулах" tab compared the website's base `price` with the chatbot's base `adult_price`. Neither is shown to a customer, and they are rounded differently, so the tab reported a difference that nobody could see (the Hainan-1 case below). A new row compares what customers actually see: the website card's "-с эхлэн" price against the cheapest adult fare the chatbot can quote for a date it offers and the website has not closed. The base rows carry a note saying they are fallbacks only. |

## 2. Which system is authoritative for prices and dates?

There is one database (Neon) but two sets of tables. The design, as it exists
and as these fixes keep it:

- **Trip facts (name, fares, dates, status) are canonical in the chatbot's
  `travel_trip_entries` row.** The website's `Trip` / `Departure` /
  `ItineraryDay` rows are a projection the chatbot writes
  (`websiteTripSync.ts`), stamped `lastSyncedAt`.
- **Website edits are not lost.** A save in the website editor is queued
  (`tripSyncQueue.ts`) and delivered to the chatbot's
  `POST /api/internal/website-trip` with the trip, the baseline staff saw and
  the edited fields. The chatbot merges three ways: a field only one side
  changed is applied; a field both sides changed differently becomes a
  `shared_conflict` that staff decide in the "Chatbot-той харьцуулах" tab
  (website value or chatbot value). The website shows the result of each
  delivery (`websiteSyncReport`: applied / conflicts / ignored) and retries
  failed deliveries.
- **Prices.** The customer-facing price is the **per-date fare**: website
  `Departure.price` and `sourceMetadata.price_groups` ↔ chatbot
  `extra.price_groups`. The base columns (`Trip.price`, `adult_price`) are
  only the fallback for a date without its own fare. The website card and the
  on-site advisor show the cheapest bookable date; the Messenger bot quotes
  the asked date's fare through its offer resolver.
- **Dates.** Website `Departure` rows ↔ chatbot `departure_dates` (text) plus
  `extra.departure_dates_resolved` (text → day) plus
  `extra.website_departure_availability` (the website's seat/status per
  day). Weekly rules stay chatbot-owned; the website is told
  (`recurring_schedule`) rather than overwriting them.
- **Status / visibility.** Chatbot-owned (`status_owned_by_chatbot`); the
  website's `isPublished` follows chatbot `status` ∈ {active, sold_out,
  paused} and `customer_visible`.

So: neither side "always wins". The last save wins per field, both-sides
edits become a visible decision, and no fare or date is overwritten silently.

## 3. The Hainan discrepancies

**Hainan-2 (ХАЙНАН – ХӨХ ХОТООС САНЬЯА НИСЛЭГТЭЙ 2):** `price_groups ignored:
open_conflict` at 2026-11-03 12:02 UTC. Cause: the bridge compared the fare
table as one list. An older unresolved conflict on `extra.price_groups` was
still open, so the whole table in that save was refused, although the edited
per-date fare was valid and unrelated to the old conflict. The old conflict has
since been resolved by staff (the live row has no open conflicts today) and
the per-date fares of both Hainan trips match on both sides today. The fix
above merges fare by fare, never refuses a save for an unrelated old conflict,
and the regression test "a real fare edit still applies beside an unrelated
old open conflict" fails on the old code. The stale "ignored" line still shown
on the website for this trip is the record of that 2026-11-03 delivery; the
next save replaces it.

**Hainan-1 (… НИСЛЭГТЭЙ - 1): chatbot 3,033,000 vs website 3,090,000.** Both
are **base** columns. `Trip.price` 3,090,000 is the projection of the first
open date's fare; the chatbot's `adult_price` 3,033,000 (and `infant_price`
918,000 vs 990,000) is an older base value from when the row was created. A
customer never sees either: the website card shows "3,090,000₮-с эхлэн" from
the dates, and the Messenger bot quotes the dated fare (3,090,000 for the
asked dates; the resolver-level audit found no quoted-price difference on
either Hainan trip). What was wrong was the comparison tab presenting unlike
values as a mismatch; that row is now labelled a fallback and a like-for-like
row was added. The base value itself was **not** changed; whether to align
the chatbot's base to the website's is a staff decision (it only matters if
every dated fare is removed).

## 4. The 61-trip audit

Two read-only passes over the live database (HTTPS SQL endpoint).

**Pass A, column by column** (`audit-live`): 174 differences on 43 of 61
trips; 18 trips identical.

| Kind | Count | What it is | Classification |
| --- | --- | --- | --- |
| Website date with no chatbot per-date fare | 99 | The chatbot answers those dates from its base price. The resolver pass found the quoted amount equal to the website's in every case checked. | Design / field mapping, not a customer-visible mismatch. |
| Chatbot dates stored as Mongolian text | 33 trips | "10 сарын 8" vs `2026-10-08`. | Field mapping. This is what broke the sync; now compared as days. |
| Base adult / child / infant price columns differ | 19 | 11 adult, 5 child, 3 infant (incl. Hainan-1, БАЛИ, Шанхай–Хүжөү, ЧУНЧИН ХОТЫН, ШАР ТЭНГИС, И Сан По, Дрийм). Website `0` vs chatbot `null` in 6 of them. | Fallback values, not customer-visible. Staff may align; not changed. |
| Per-date fare cell null on one side | 4 | Турк 2026-12-26 adult; ЧУНЧИН-ГАЗАР 1 2028-08-09 child/infant; Чунчин-Жанжиажэ 2026-11-05 infant. | Missing data (see §5). |
| Future website dates absent from the chatbot's list | 8 trips | Four weekly trips (Бээжин-Жинин, ЖИНИН–ХӨХ ХОТ-ОРДОС, ЖИНИН-МИНИ АВАТАР, Япон Токио): the chatbot keeps a weekly rule and does offer those days (resolver pass: no difference). Four others carry 2027/2028 rows (Хайнан-Эрээн, ШЭНЬЖЭНЬ, ЧУНЧИН-ГАЗАР 1, Турк 2026-12-26). | Weekly: intentional. 2027/2028 rows: stale / suspect data (§5). |
| Last delivery "ignored" | 1 | Hainan-2, 2026-11-03 (§3). | Stale sync; fixed. |
| Visibility | 1 | Макао – Жухай – Хайлин арал: published on the website, archived on the chatbot. | Genuine staff conflict (§5). |
| Open `shared_conflicts` | 9 | Макао status (1, since 2026-11-01); ЧУНЧИН-ГАЗАР НИСЛЭГ ХОСОЛСОН 1 (8: status, 3× departure_dates, 4× price_groups). | Genuine staff conflicts (§5). |

**Pass B, what customers see and hear** (`audit-effective`): for every
published trip and every current date, the website's open status and fare
against the Messenger bot's own offer resolver. **6 findings on 4 trips; no
quoted-price difference anywhere.**

| Trip | Finding | Classification |
| --- | --- | --- |
| ЖИНИНЬ ХАЛУУН РАШААН…, Чунчин-Жанжиажэ…, ЭРЭЭН–БЭЭЖИН–…ФҮКҮОКА | Published on the website, chatbot status `paused`. | Intentional: `paused` means staff pulled bookings without cancelling; the chatbot still shows the trip and says bookings are temporarily closed; the website keeps it published. Consistent. |
| Макао – Жухай – Хайлин арал | Published vs archived, open status conflict since 2026-11-01. | Staff decision. |
| Турк - Анталяа-Памуккале, 2026-12-26 | Website OPEN at 4,890,000; bot "departure not offered". The chatbot has a "12 сарын 26" fare group with no adult price and the day is not in its schedule. | Missing data; the fixed bridge carries the day and its fare on the next website save of this trip. Staff should confirm the date and fare. |

## 5. Fixed versus needs a human decision

Fixed in code (both branches): day-based schedule sync, per-date fare merge,
no refusal for unrelated old conflicts, weekly-rule protection, schema order,
the misleading comparison row, plus everything in the phase-1 report (removed
dates returning, duplicate dates, negative fares, conflict decision panel,
Save button, stay on trip and tab, on-site advisor dates and prices).

Not changed, needs staff:

1. **Макао – Жухай – Хайлин арал**: active (website) or archived (chatbot)?
   Decide in the trip's "Chatbot-той харьцуулах" tab.
2. **ЧУНЧИН-ГАЗАР НИСЛЭГ ХОСОЛСОН 1**: 8 open conflicts (status, dates, fare
   table), including 2027/2028 date copies. Decide per conflict in the same
   tab; several are duplicates of one disagreement and will clear together.
3. **2027 / 2028 departure rows** on Хайнан-Эрээн (4), ШЭНЬЖЭНЬ (4),
   ЧУНЧИН-ГАЗАР 1 (many), Турк (cancelled): weekly copies a year or two ahead
   that look like mis-entries. Not deleted; confirm and remove in the editor.
4. **Турк - Анталяа-Памуккале 2026-12-26**: confirm the date and its 4,890,000
   fare, then re-save the trip once the chatbot branch is deployed.
5. **Base price columns** on 7 trips (§4): align or leave; fallback only.
6. **Messenger conversation flow** (not a sync issue): after "Энэ аяллын
   хүүхдийн үнэ хэд вэ?" the bot correctly asks for a date, but when the date
   is given it answers availability and drops the child-price question. Owned
   by the chatbot's conversation gating; reported, not changed.

## 6. Are dashboard, website, on-site chatbot and Messenger chatbot consistent?

For prices and dates that customers can see or hear: **yes today**, per the
resolver-level audit (no quoted-price difference on any published trip), with
the exceptions in §4 pass B. End to end on the local copy (script 09): a fare
edited in the admin editor was delivered without an "not sent" warning, the
chatbot's fare table changed, the chatbot projected back to the website, and
the Messenger bot's real processing quoted the new fare for that date;
restoring the fare flowed the same way. The on-site advisor reads the same
`Trip` / `Departure` rows as the cards. The admin comparison tab now compares
customer-visible prices.

This holds **once both branches are deployed**. Production today still runs
the old bridge, so a date added on the website still does not reach the bot
and a fare edit can still be refused beside an unrelated old conflict.

## 7. Deployed to production?

**No.** Verified against Vercel at 2026-11-04 ~11:00 UTC:

| Project | Production (target=production, READY) | This work |
| --- | --- | --- |
| `uudam-booking-web` | `f94fd1d` (`main`), deployed 06:31 UTC | `claude/optimistic-maxwell-j5w7em`: `4bf6788` preview READY (10:22 UTC); this commit adds the comparison row, the sync text and this report. |
| `uudam-chatbot` | `044d51d` (`main`), deployed 10:23 UTC | `claude/website-sync-schedule-fares`: `b76ce8f` preview READY (10:56 UTC). `main` auto-deploys on merge. |

Nothing was merged or promoted. Pushed ≠ deployed; merging to `main` deploys
both projects. Order does not matter for safety; the website change is
tolerant of the old chatbot and vice versa.

## 8. What was tested how

| Check | How | Result |
| --- | --- | --- |
| Admin editor: prices, dates, passenger bands, repeated saves, refresh, tabs, unsaved-changes guard, Save button | Real browser (Playwright) on the local admin with a copy of the live catalogue (scripts 02, 03) | PASS (phase-1 report) |
| Two staff editing the same trip | Real browser, two sessions (04) | PASS |
| Failure scenarios: offline, 500, expired session, invalid values, duplicate dates, rapid clicks, dirty reload | Real browser with request interception (05) | PASS |
| Rest of the dashboard incl. mobile | Real browser (07) | PASS |
| Website + on-site advisor after edits, Mongolian/Latin phrasing | Real browser + API (06) | PASS |
| Production-mode build, ISR revalidation | Local `next start` production build (08) | PASS |
| Admin edit → sync → Messenger bot's processing → write-back | Real browser for the edit; local chatbot server with real OpenAI, Meta sending mocked (09) | PASS |
| 7 Messenger questions ("Хайнан аялал хэд вэ?", "…дараагийн аялал хэзээ вэ?", "Hainan une hed ve?", "11 сард явах аялал байна уу?", "12 сард Хайнан явах уу?", "Хайнан 2 аяллын үнэ?", "Энэ аяллын хүүхдийн үнэ хэд вэ?") | Local chatbot `/api/demo` and webhook path, mocked delivery (09) | PASS for 6; the child-price follow-up issue in §5.6 |
| Booking/payment never confirmed by any bot | Same (06, 09) | PASS: handoff to staff every time |
| Comparison tab shows the customer-visible starting price with its note | Real browser on the local admin (10) | PASS |
| Bridge regression tests, chatbot full suite, conversation gate | Local, chatbot repo | PASS (1698/0, 136/136) |
| 61-trip audit | Live database, read-only, HTTPS SQL | Done (§4) |
| Live Facebook Messenger delivery | Not done by design (would message real people) | NOT TESTED |
| Production deployment of the fixes | Not done (needs merge) | NOT DONE |
| Vercel environment variable listing | 403 for this token | BLOCKED (not needed for the fixes) |

Browser scripts, screenshots and the two audit result files live in the
session scratchpad, not in the repository.

## 9. What remains

- Merge both branches to `main` (deploys both). Then re-save the Турк trip
  once so 2026-12-26 reaches the bot.
- The six staff decisions in §5.
- Chatbot conversation flow: child-price question lost after a date
  clarification (§5.6).
- The chatbot's `quotablePrices` still lists the base `adult_price` alongside
  dated fares in some replies; harmless while bases are close to dated fares,
  worth tightening.
- A scheduled read-only re-run of the resolver-level audit would catch any
  future drift within a day.
