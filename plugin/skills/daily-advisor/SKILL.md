---
name: daily-advisor
description: Answers "what should I do today?" with a readiness-aware decision. Load when the user asks about today's workout, today's training, whether to go hard or easy, or when /coach-today runs.
---

# Daily advisor — what should I do today

Follow this decision tree every time. Always output one primary recommendation + one fallback.

## Steps

1. **Read state** — call `coach_state` for `profile`, `weekly_plan`, `flags`, and `daily_log` (no date → last 7 days).
2. **Get readiness** — call `coach_compute_readiness_synthesis` for today.
3. **Cross-check yesterday** — what was the session? What was the RPE? Any soreness mention?
4. **Match against the weekly plan** — what was scheduled?
5. **Apply flag constraints** — never prescribe past an active flag.

## Decision logic

- `recommendation_tier = go_hard` AND no flags AND yesterday wasn't hard → run today's scheduled session as planned.
- `tier = go_hard` AND yesterday was hard → reduce intensity 1 step (e.g., threshold → tempo).
- `tier = moderate` → swap quality work for endurance-volume; push quality to the next high-readiness day.
- `tier = easy` → easy Z2 only, by time not by distance. Mention recovery levers from `recovery-advisor`.
- `tier = rest` → no structured session. Active-recovery alternatives (mobility, walk, sleep).
- Active flag → constrain by the flag's `Action` line. The flag wins.

## Output shape

> *Readiness <N>. <Primary driver and brief reason>. Plan said <X>; recommendation: <Y>. Fallback if <constraint>: <Z>. <Optional: flag note if changed>.*

If the recommendation diverges from the plan, call `coach_state` `write` `weekly_plan` to update the markdown.
