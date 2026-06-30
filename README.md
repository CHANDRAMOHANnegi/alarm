# Aura Clock

Aura Clock is a React Native + Expo alarm, planning, daily task, and phone-usage
tracker. It is currently Android-first because app usage statistics require a
custom native Android module and Usage Access permission.

## Run

```sh
npm install
npm run typecheck
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home npm run android
```

Metro normally runs on port `8085` during local development.

## Architecture

- `App.tsx` is only the app entry point.
- `src/app/AppRoot.tsx` contains the current app root and screens.
- `android/app/src/main/java/com/aura/clock/AppUsageModule.kt` exposes Android
  UsageStatsManager to JavaScript.
- `rn-template.md` is the project standard to keep future React Native work
  consistent.

The next refactor should split `src/app/AppRoot.tsx` into `src/screens`,
`src/components`, `src/services`, `src/store`, and `src/theme`.

## Core Features

- Alarm scheduling with local notifications
- Morning planner
- Evening retrospection with mood and energy scoring
- Daily recurring tasks with completion and streaks
- Android app usage summary after Usage Access is granted
- Analytics for planning, retrospection, habits, and phone usage

## Permissions

Android app usage tracking requires `PACKAGE_USAGE_STATS`. Android does not show
a normal runtime permission dialog for this; the user must grant Usage Access in
system settings.

## Validation

```sh
npm run typecheck
```

Native Android builds should use JDK 17. JDK 25 caused native build failures in
the Expo/RN Android toolchain.
