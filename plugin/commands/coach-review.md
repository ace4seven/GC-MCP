---
description: Weekly retrospective — adherence, load trajectory, opened/closed flags, the one thing to change next week.
---

# /coach-review

Use `pattern-detective` for the red-flag sweep.

1. Read profile, goals, current-block, flags.
2. `coach_state read daily_log` (last 7 days).
3. `coach_compute_load_summary` — compare this week's window vs the prior week.
4. Run `pattern-detective` full sweep.
5. Compose a concise retrospective:
   - Adherence: sessions completed / planned.
   - Load: this week's acute load + ACWR zone + trend vs prior week.
   - Flags: opened, closed, escalated this week.
   - **One thing to change next week.** Not three. One.
6. Save via `coach_state write review` with `weekId` set to the current ISO week (see `currentIsoWeek` semantics).
7. Suggest `/coach-plan-week` for next week.

Honest, not motivational. The user wants accuracy, not pep talks.
