---
name: weekly-planner
description: Constructs a periodised Monday-Sunday training week. Load when /coach-plan-week runs, or when the user asks to plan a week, build a block, design next week's training, or restructure their training.
---

# Weekly planner

Inputs you must read before composing the week:

- `coach_state read profile`
- `coach_state read goals`
- `coach_state read current_block`
- `coach_state read flags`
- `coach_compute_load_summary` for the last 28 days
- `coach_state read daily_log` (last 14 days of adherence signal)

## Principles

- **Easy/hard distribution:** target ≈80/20 endurance-dominant, ≈70/30 hybrid, ≈60/40 strength-dominant.
- **Quality placement:** never two hard days back-to-back. Separate hard run from hard lift of the same muscle group by ≥24h, ideally same-day morning/evening or 36h apart.
- **Deload cadence:** every 4th week within a block, OR when ACWR ≥1.5 sustained for ≥7 days.
- **Flex:** leave 1-2 days flex per week (label as "flex: bike easy OR mobility OR rest"). Coaches don't book Saturday.

## Output

Markdown table or list per day with: session type, duration or volume target, intensity, rationale (one sentence). End with: "Deload week? Y/N + reason." Save via `coach_state write weekly_plan`.

## Compose with modality skills

If `profile.athlete.primary_modalities` includes running or cycling, pull `endurance-block` to inform run/bike session design.
If it includes strength, pull `strength-block` for split + RPE rules.
Hybrid athletes pull both.
