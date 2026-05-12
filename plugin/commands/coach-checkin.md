---
description: Frictionless subjective daily log — captures energy, soreness, sleep, completed session, RPE, optional notes.
---

# /coach-checkin

Single fast loop. Don't moralise; just collect.

1. Ask in one prompt: "Energy (1-10)? Soreness anywhere? Sleep last night? What did you do today? RPE (1-10)? Anything else?" Accept partial answers.
2. Call `coach_log_subjective` with whatever the user gave.
3. Load `pattern-detective` and run the soreness-recurrence + sleep-debt checks against the last 7 days (since this check-in is fresh data).
4. Reply in 1-2 sentences: acknowledge, then name any pattern you spotted ("this is your third 'tired' day in a row — I'm watching" / "calves mentioned again, opening an overuse flag").
5. If a flag opened or escalated, write `flags.md` and tell the user the constraint that now applies.

Do not lecture, do not motivate. Just log + observe + flag.
