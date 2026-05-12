---
description: First-run bootstrap. Infers an athlete profile from 90 days of Garmin data, then confirms with five quick questions and writes the starter training block.
---

# /coach-onboard

Use the `onboarding` skill end-to-end.

1. Call `coach_state` with `action: "read", kind: "profile"`. If a profile already exists, ask the user: "You already have a profile. Re-onboard (overwrites) or refine (`/coach-checkin` updates)?" Halt unless they choose re-onboard.
2. Phase 1: silent inference per the `onboarding` skill.
3. Phase 2: confirmation interview, one question at a time.
4. Phase 3: write `profile.json`, `goals.md`, `current-block.md`.
5. Close with: "Profile written. Want me to build this week's specific sessions now? (`/coach-plan-week`)"

Time budget: aim for under three minutes of user-facing chat.
