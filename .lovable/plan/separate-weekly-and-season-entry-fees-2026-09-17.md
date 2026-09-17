# Separate Weekly and Season Entry Fees

## Goal
Treat the Season Pot fee as an additional, independent charge rather than taking a percentage from weekly entry fees.

## Changes
- Add a league-level Season Pot entry fee alongside the weekly entry fee.
- Track Season Pot payment status separately for every member and pick set.
- Keep weekly payment checkboxes and Weekly Pot totals unchanged and week-specific.
- Replace the Season Pot percentage control with per-set Season Pot payment checkboxes and an independent fee amount.
- Automatically total paid Season Pot entries and reflect that amount in the League Bank.
- Update standings, member, cash, payout, leaderboard, and commissioner summaries to show the correct independent amounts.

## Technical details
- Use a dedicated secured Season Pot payments table keyed by league, member, and entry number.
- Preserve existing weekly payment records without converting or splitting them.
- Keep manual Weekly Pot and Season Pot overrides available.
- Validate the signed-in commissioner workflow on mobile and check the final app health.
