---
name: onboarding
description: Bootstraps a brand-new athlete profile by inferring from Garmin data first, then confirming with five quick questions. Load this skill when /coach-onboard runs, or when any coaching interaction discovers `coach_state read kind=profile` returns null.
---

# Onboarding — bootstrap a new athlete

Goal: produce a working `profile.json`, `goals.md`, and `current-block.md` in under five minutes of user time. Infer aggressively from Garmin data; ask the fewest possible questions.

## Phase 1 — Silent inference (no questions yet)

Fire these MCP tool calls in parallel and synthesise a draft profile:

- `list_activities` with `limit: 100` and a 90-day date range
- `get_training_status` (30-day range)
- `get_vo2max`
- `get_hrv_status` (30-day range)
- `get_user_profile`
- `get_personal_records`
- `list_gear`

Derive:

- **Primary modalities** = top 1-2 sport types by `frequency × duration` over 90 days. Group as `running` / `cycling` / `strength` / `mixed_conditioning` / `other`.
- **Secondary modalities** = anything else with ≥10% share.
- **Experience level** — `beginner` if <1 year of data or VO2max <40th percentile; `advanced` if VO2max >75th percentile and ≥3 distance/strength PRs; `intermediate` otherwise.
- **Weekly hours available** = median weekly activity hours over last 8 weeks, rounded.
- **Preferred training days** = days-of-week with ≥60% activity frequency over 90 days.
- **Baselines** = pulled directly from Garmin: resting HR, HRV 7d avg, VO2max running/cycling, weight if available.
- **Constraints** = empty for now (only user fills).

Show the draft to the user, then ask Phase 2 questions.

## Phase 2 — Confirmation interview (5 questions)

Ask one question at a time. Don't batch.

1. **Modality confirmation** — show your inferred split and ask if it matches.
2. **Goal in user's own words** — store verbatim in `goals.md`. Do not structure or rephrase. One sentence.
3. **Time honesty** — distinguish historical median from current capacity. "Is 6.2 hours/week what you have, or what you've been managing?"
4. **Constraints** — free-form: injuries, sore joints, life things, untrainable days.
5. **Voice** — direct / coach-style / inquisitive. Default coach-style.

## Phase 3 — Starter block (write without asking)

Write `current-block.md` automatically:

- 4-week conservative block.
- Stated goal: "Establish baseline + earn the right to push." Not the user's goal yet.
- Volume: 90% of the last 4 weeks' average. Deliberately under-prescribed for trust.
- One quality session per primary modality per week. Everything else easy.
- Deload built into week 4.

Save:

- `coach_state` `write` `profile` with the inferred + confirmed object.
- `coach_state` `write` `goals` with the verbatim string.
- `coach_state` `write` `current_block` with the starter block markdown.

End by suggesting `/coach-plan-week` to materialise the first week's specific sessions.

## What never to do

- Don't run a fitness test. The user has 90 days of data already.
- Don't ask for subjective ratings of recent training. First-day self-reports are noisy.
- Don't program directly toward the stated goal. Earn signal first.
