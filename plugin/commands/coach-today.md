---
description: Morning decision. Reads readiness, weekly plan, recent logs, and active flags; outputs today's prescription with a fallback.
---

# /coach-today

Follow the `daily-advisor` skill exactly. Workflow:

1. `coach_state read profile` (halt with "run `/coach-onboard` first" if null).
2. `coach_compute_readiness_synthesis` for today.
3. `coach_state read weekly_plan`.
4. `coach_state read daily_log` (returns last 7 days).
5. `coach_state read flags`.
6. Apply `daily-advisor` decision tree.
7. If recommendation diverges from the plan, write the updated week back to `coach_state weekly_plan`.

Output: one paragraph readiness summary + one-line prescription + fallback. If a flag opened/closed/escalated, name it.
