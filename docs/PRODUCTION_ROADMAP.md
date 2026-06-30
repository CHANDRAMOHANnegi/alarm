# Production Roadmap

## Phase 1: Structure

- Split `src/app/AppRoot.tsx` into screens.
- Move repeated UI into `src/components`.
- Move storage and native bridges into `src/services`.
- Add centralized theme tokens in `src/theme`.
- Add a lightweight store in `src/store`.

## Phase 2: Quality Gates

- Add Jest.
- Add React Native Testing Library.
- Add tests for daily task helpers.
- Add tests for alarm date parsing.
- Add Maestro smoke flows.
- Add visual screenshot baselines.

## Phase 3: Product Depth

- Add task scheduling reminders.
- Add weekly habit review.
- Add usage insights around bedtime and wake-up.
- Add export for local user data.
- Add settings for privacy and notification preferences.

## Phase 4: Release

- Test on real Android device.
- Prepare privacy policy.
- Prepare production signing.
- Run Play Store internal testing.
