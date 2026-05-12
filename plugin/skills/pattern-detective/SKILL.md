---
name: pattern-detective
description: Proactively surfaces red flags in recent training and recovery data — overuse patterns, HRV drift, sleep debt, modality imbalance, soreness recurrence. Load on /coach-review, /coach-checkin, and whenever a coaching response touches recent multi-day data.
---

# Pattern detective — catch what the user would miss

Run this checklist whenever you have access to ≥7 days of context. Each pattern has a query, a threshold, and an action.

## Checklists

### HRV drift
- **Query:** `get_hrv_status` 30-day range.
- **Threshold:** 7-day HRV average ↓ >10% vs 28-day average.
- **Action:** open or escalate `hrv-drift` flag. Recommend 5-7 day load reduction + cause-finding (sleep, alcohol, stress).

### Resting HR creep without HRV drop
- **Query:** `get_heart_rate` last 14 days.
- **Threshold:** resting HR up ≥3 bpm vs 14-day baseline while HRV is stable or up.
- **Action:** suspect hydration / illness / alcohol. Ask the user before opening a flag.

### Soreness recurrence
- **Query:** `coach_state read daily_log` (last 7 days).
- **Threshold:** same body part in `soreness` ≥3 times in 10 days.
- **Action:** open `<bodypart>-overuse` flag with 14-day watch. Add modality constraint (e.g. cap long runs).

### Sleep debt
- **Query:** `get_sleep_data` last 7 days.
- **Threshold:** total sleep <6h on ≥4 of last 7 nights, OR average sleep score <55.
- **Action:** open `sleep-debt` flag. No quality work prescribed until average ≥6.5h for 3 nights.

### Modality imbalance with active flag
- **Query:** `coach_compute_load_summary` + `coach_state read flags`.
- **Threshold:** any modality ≥80% of load with an open flag tied to that modality.
- **Action:** prescribe a 7-day substitute (e.g. run → bike) until flag closes.

## Writing flags

When a flag opens, append to `flags.md` via `coach_state write flags`. Use this format:

```
- **<slug>** (opened <YYYY-MM-DD>, watching <N>d):
  <One-line description>. Watch: <escalation criterion>.
  Action: <constraint applied to recommendations>.
```

When a flag closes, move it under `## Closed flags` with a `closed <YYYY-MM-DD>` note.

## Telling the user

Always name flag changes in the current response. Don't bury them in the next review.
