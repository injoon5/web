# The iOS Shortcuts

Two shortcuts feed `/health`. One posts the day's metric totals every hour; the
other posts workouts once a day. Both hit `POST /health/ingest` on the Convex
`.site` domain with `Authorization: Bearer $HEALTH_API_KEY`.

There is no `.shortcut` file in this repo. Shortcuts files are signed archives —
Apple's `shortcuts sign` on macOS is the only way to produce one that iOS will
import, and an unsigned plist assembled by hand can't be verified without a
device. Building these in the app takes about fifteen minutes and you end up
able to edit them, which you will want to do.

What _is_ checked in: `payloads/*.json`, the exact bodies these shortcuts send.
`convex/http.test.js` replays them through the real endpoint, so if the app-side
build ever misbehaves you can tell immediately whether the payload or the
backend is at fault.

---

## Before you build anything

Confirm the endpoint is live and the key works, so a later failure can only be
the Shortcut:

```sh
HEALTH_API_KEY=<key> node shortcuts/smoke.mjs https://<deployment>.convex.site
```

That posts both fixtures and reads the series back. If it prints `ok`, every
problem from here on is in the app.

---

## Shortcut 1 — Health metrics (hourly)

Posts one day row per metric. Re-sending the same day is free: rows are upserted
on `(metric, date)`, so the last run of the day wins.

### Per metric

Repeat this block for each of `steps`, `distance`, `activeEnergy`,
`exerciseMinutes`, `restingHeartRate`:

1. **Find Health Samples**
   - `Sample Type` → the matching type (Steps, Walking + Running Distance,
     Active Energy, Exercise Minutes, Resting Heart Rate).
   - `Start Date` is `Today`.
   - **`Source` is `<your Apple Watch>`.** Do not skip this on steps, distance
     or energy — see the gotcha below.
   - For `restingHeartRate` only: `Sort by Start Date`, `Order Descending`,
     `Limit 1`.
2. **Calculate Statistics**
   - `Sum` for steps, distance, activeEnergy, exerciseMinutes.
   - `Average` for restingHeartRate (with Limit 1 above, this is just the value).
3. **Set Variable** → name it after the metric key exactly: `steps`, `distance`,
   `activeEnergy`, `exerciseMinutes`, `restingHeartRate`.

### Then, once

4. **Date** → Current Date. **Format Date** → `Custom`, format string
   `yyyy-MM-dd`. Set Variable `today`.
5. **Dictionary** — three keys:
   - `date` → the `today` variable
   - `source` → text, e.g. `Apple Watch`
   - `metrics` → **Dictionary**, one row per metric, key = the metric key,
     value = the variable you set. The keys must match
     `^[A-Za-z][A-Za-z0-9_]{0,63}$` exactly — `restingHeartRate`, not
     `resting heart rate`.
6. **Get Contents of URL**
   - URL: `https://<deployment>.convex.site/health/ingest`
   - Method: `POST`
   - Headers: `Authorization` → `Bearer <your HEALTH_API_KEY>`
   - Request Body: `JSON`, and pass the dictionary from step 5.

### Optional: intraday heart rate

To get the hourly chart, add before step 5:

- **Find Health Samples** → `Heart Rate`, `Start Date` in the last hour, source
  filtered.
- **Repeat with Each** over the result, building a Dictionary of
  `{ metric: "heartRate", value: <Value>, timestamp: <Start Date> }` and adding
  it to a list variable `samples`.
- Add `samples` as a fourth key on the step-5 dictionary.

Keep this to **the last hour only**. Ingest reads a dedupe window per touched
hour, so a payload may span at most 12 metric-hours; more than that returns 400
asking you to split it. The hourly automation naturally stays at one.

### Automation

Personal Automation → Time of Day → Hourly → **Run Immediately**, notifications
off. Add a second one at **23:55** so the last hour of the day lands before the
date rolls over.

---

## Shortcut 2 — Workouts (daily)

1. **Find Workouts** → `Start Date` `is within the last` `1` `days`.
2. **Repeat with Each** over the result. Inside, build a **Dictionary** from the
   Repeat Item's properties (tap the variable to pick each one):
   - `type` → Workout Type
   - `start` → Start Date
   - `end` → End Date
   - `distance` → Distance (omit for indoor workouts)
   - `activeEnergy` → Active Energy
   - `avgHeartRate` / `maxHeartRate` → the heart rate details, if present
   - **Add to Variable** `workouts`.
3. **Dictionary** → `source` (text) and `workouts` (the list variable).
4. **Get Contents of URL** — same URL, method, and header as shortcut 1.

`duration` is optional; the server derives it from `end - start`.

Re-runs are safe. Identity is `${type}:${startMs}`, which is stable across
re-syncs because Shortcuts exposes no workout UUID — a repeat send updates the
row rather than adding one.

### Automation

Personal Automation → Time of Day → Daily, some time after midnight,
Run Immediately.

---

## Things that will bite

**Step double-counting.** "Find Health Samples" returns raw samples from _every_
source. The iPhone and the Watch both record steps, and the Health app
deduplicates them only on display — Shortcuts does not. Summing without a
`Source is <Apple Watch>` filter roughly doubles your step count. Same for
distance and active energy.

**Formatted numbers are fine.** Calculate Statistics can hand you `8,421` with
the separator still attached. The endpoint unpicks that shape (and plain numeric
strings) rather than 400ing over a comma. It will not guess at an ambiguous
`8,4`.

**Metric keys are the contract.** They are what `metricKind()` and `metricUnit()`
in `convex/lib/health.js` switch on, and what `/health` renders. A typo creates a
new metric that nothing displays rather than an error.

**The date is yours, not the server's.** `date` is written in the phone's local
calendar. The server never overrides it, and the read window reaches one day past
UTC-today so a UTC+9 "today" is always inside it.

**Timezone of samples.** Sample timestamps go over the wire as ISO-8601 with an
offset, and buckets are keyed on the resulting instant. The hourly chart is
therefore in UTC hours; that only matters if you read the raw
`/health/series?bucket=hour` output directly.
