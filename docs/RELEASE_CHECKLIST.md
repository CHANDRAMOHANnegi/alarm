# Release Checklist

## Internal Release

- `npm run typecheck` passes.
- Android debug build launches.
- Fresh install works.
- Alarm scheduling works.
- Daily task add/complete/hide works.
- Usage Access denied state works.
- Usage Access granted state shows app usage.
- Morning planner saves and reloads.
- Evening retro saves and reloads.
- Dark UI is readable.
- Large text does not break core screens.

## Store Release

- Replace debug signing with production signing.
- Bump version and Android version code.
- Add privacy policy.
- Confirm no private user content is logged.
- Confirm production permission rationale copy.
- Test on real Android device.
- Add release notes.
- Tag accepted release commit.
