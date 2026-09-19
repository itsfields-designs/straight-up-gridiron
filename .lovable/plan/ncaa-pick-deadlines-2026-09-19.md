# NCAA pick deadlines

## Goal
Make each NCAA week’s pick deadline obvious and consistent in NCAA leagues and the platform-wide Top 25 pick’em.

## Changes
- Treat the first scheduled kickoff in the selected week as the weekly deadline for both experiences.
- Add a prominent deadline panel above the games showing:
  - the exact local deadline with time zone
  - a live countdown while picks are open
  - a clear “Picks locked” state after the deadline
- Update the countdown automatically without requiring a refresh, including the transition to locked at kickoff.
- Disable all pick, tiebreaker, set, and save actions after the weekly deadline.
- Keep existing saved picks visible after locking and explain that they can no longer be changed.
- Keep NFL behavior unchanged.

## Technical details
- Add a small shared NCAA deadline utility/component so league picks and Top 25 pick’em use identical deadline calculations and wording.
- Derive the deadline from the earliest valid kickoff, falling back to the stored week lock only when kickoff data is unavailable.
- Update Top 25 pick’em from per-game locking to the shared per-week lock rule.
- Verify open and locked displays at mobile and desktop sizes, then check type and preview build health.
