---
description: Build the upcoming Monday-Sunday training week with rationale per session and deload flagging.
---

# /coach-plan-week

Follow the `weekly-planner` skill.

1. Read profile (halt if null with "run /coach-onboard first"), goals, current-block, flags.
2. `coach_compute_load_summary` with `window_days: 28`.
3. `coach_state read daily_log` (last 14 days).
4. Compose Mon-Sun. Honour the 1-2 flex day rule.
5. Save via `coach_state write weekly_plan`.
6. Output a tight markdown table or list. End with one-line: deload Y/N + reason.
7. Remind the user: `/coach-checkin` daily so next week's plan has real adherence signal.
