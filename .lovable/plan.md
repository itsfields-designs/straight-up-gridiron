# Match NCAA league picks to Top 25 pick'em

## Goal
Make every NCAA league pick board use the same mobile-first game cards, team logos/ranks, pick states, progress text, and saved/locked action bar shown on the Top 25 pick'em board.

## Changes
- Preserve NCAA league-specific saved sets, entry fees, scoring, locking, and standings.
- Carry college team rank and logo data into league games instead of discarding it during normalization.
- Add the Top 25 pick'em card presentation to NCAA league picks while leaving NFL league picks unchanged.
- Keep multiple NCAA pick sets available above the matching game-card layout.
- Match the save bar wording and de-illuminated saved state.

## Verification
- Check a Top 25 board and an NCAA league board at mobile size for visual parity.
- Confirm selecting, saving, switching sets, and locked final games still behave correctly.
- Confirm the app builds without errors.
