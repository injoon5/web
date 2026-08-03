# The iOS Shortcut

One shortcut feeds `/health`. It posts the day's totals every hour to
`POST /health/ingest` on the Convex `.site` domain, with
`Authorization: Bearer $HEALTH_API_KEY`.

There is no `.shortcut` file here — Shortcuts archives are signed, and only
Apple's `shortcuts sign` on macOS produces one iOS will import. What is checked
in is `payloads/*.json`, the exact bodies the endpoint expects.
`convex/http.test.js` replays them, so a broken sync can be pinned on the app or
the backend without guessing.

Check the endpoint before building anything:

```sh
HEALTH_API_KEY=<key> node shortcuts/smoke.mjs https://<deployment>.convex.site
```

---

## Build it

For each of `steps`, `distance`, `activeEnergy`, `exerciseMinutes`:

1. **Find Health Samples** — the matching sample type, `Start Date` `Today`,
   and **`Source` is `<your Apple Watch>`**.
2. **Calculate Statistics** — `Sum`.
3. **Set Variable**, named after the metric key exactly.

Then, once:

4. **Format Date** on Current Date, `yyyy-MM-dd` → variable `today`.
5. **Dictionary**: `date` → `today`, `source` → e.g. `Apple Watch`, and
   `metrics` → a nested dictionary of metric key → variable.
6. **Get Contents of URL** — `POST` to
   `https://<deployment>.convex.site/health/ingest`, header `Authorization` →
   `Bearer <key>`, request body `JSON`.

Automation: Time of Day → Hourly → **Run Immediately**, notifications off, plus
one at **23:55** so the last hour lands before the date rolls over.

Re-sending a day is free: rows are upserted on `(metric, date)`.

### Optional extras

Any metric key in `metricUnit()` can be added the same way — the endpoint stores
it, and `/health` renders only the four above. `restingHeartRate` is a useful
one: sort descending, `Limit 1`, then `Average`.

For the hourly heart-rate chart, add a `samples` key: **Repeat with Each** over
the last hour's Heart Rate samples building
`{ metric: "heartRate", value: <Value>, timestamp: <Start Date> }`. Keep it to
one hour — a payload may span at most 12 metric-hours before the endpoint asks
you to split it.

**Workouts are not synced.** `/health/ingest` accepts a `workouts` array and
`/health/workouts` reads it back, but Shortcuts can't build the payload, so
nothing posts it and the page doesn't show a workout list.

---

## Things that will bite

**Step double-counting.** "Find Health Samples" returns raw samples from _every_
source. The iPhone and the Watch both record steps, and the Health app
deduplicates them only on display — Shortcuts does not. Summing without a
`Source is <Apple Watch>` filter roughly doubles steps, distance and energy.

**Formatted numbers are fine.** Calculate Statistics can hand you `8,421` with
the separator attached. The endpoint unpicks that shape rather than 400ing over
a comma. It will not guess at an ambiguous `8,4`.

**Metric keys are the contract.** They are what `metricKind()` and `metricUnit()`
in `convex/lib/health.js` switch on, and what `/health` renders. A typo creates a
new metric that nothing displays rather than an error.

**The date is yours, not the server's.** `date` is written in the phone's local
calendar. The server never overrides it, and the read window reaches one day past
UTC-today so a UTC+9 "today" is always inside it.
