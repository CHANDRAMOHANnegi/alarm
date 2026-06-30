# Aura Clock PRD

## Problem

The user wants one mobile cockpit for waking up, planning the day, checking
daily commitments, reviewing the evening, and understanding phone usage patterns.

## Target User

An individual user building disciplined personal routines around fitness,
learning, planning, and distraction awareness.

## Core Flows

- Schedule an alarm and receive a local notification.
- Complete a morning plan.
- Track recurring daily tasks such as gym and system design study.
- Review the day with mood and energy scores.
- Grant Android Usage Access and view app usage patterns.
- Review analytics for streaks, task completion, and usage.

## MVP Scope

- Android native dev build.
- Local-only AsyncStorage persistence.
- Local notifications.
- Text-to-speech prompts.
- Daily tasks with add, complete, streak, and hide.
- Android app usage summary using UsageStatsManager.

## Out Of Scope

- Accounts and cloud sync.
- iOS app usage tracking.
- Production app store release.
- Paid features.
- AI-generated scheduling.

## Privacy And Security

- Data is local-first.
- No remote analytics are currently sent.
- Usage Access is requested only to show user-visible phone usage summaries.
- No private user content should be logged in production builds.

## Non-Functional Requirements

- Works offline after install.
- Handles permission denied states.
- Uses JDK 17 for Android native builds.
- Keeps native Android usage code tracked in version control.

## Milestones

1. Stabilize current single-root implementation.
2. Split `AppRoot` into screens, components, services, store, and theme.
3. Add Jest tests for task, alarm, usage, and date helpers.
4. Add Maestro launch, task completion, alarm scheduling, and permission flows.
5. Add visual diff baselines.
