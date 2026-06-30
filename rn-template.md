# React Native App Template

Use this as the starting standard for any React Native application. It favors
Expo native builds, React Navigation, Zustand, centralized theming, strong test
gates, Maestro flows, and visual regression checks.

## 1. Product Definition

Before building screens, define the product contract:

- App name: `<APP_NAME>`
- Primary user: `<USER_SEGMENT>`
- Core job to be done: `<ONE_SENTENCE_OUTCOME>`
- First release scope: `<MVP_SCOPE>`
- Out of scope for first release: `<EXPLICIT_NON_GOALS>`
- Platforms: iOS, Android, optional Web prototype
- Offline/local-first expectation: `<YES/NO>`
- Account/cloud expectation: `<YES/NO>`
- Paid features: `<FREE/PREMIUM/SUBSCRIPTION>`

Product rule: a button should do what its label says. Do not show fake shortcuts
that only route to a generic page unless they are clearly labelled as navigation,
for example `More`, `Browse`, or `All Tools`.

## 2. Recommended Stack

- Framework: Expo + React Native + TypeScript
- Native runtime: Expo prebuild / custom development client for real device APIs
- Navigation: React Navigation
- State: Zustand for client state and screen workflows
- Persistence: AsyncStorage for lightweight local state; SQLite only when data
  becomes relational or query-heavy
- Styling: centralized theme tokens and shared style presets
- Icons: `@expo/vector-icons` unless the app already has a stronger icon system
- i18n: `i18n-js` or equivalent, wired through app state so locale changes
  re-render screens
- Testing: Jest + React Native Testing Library
- E2E: Maestro
- Visual diffs: Maestro screenshots + PNG comparator
- Release: EAS or native store tooling, never debug keystores for production

## 3. Folder Structure

```text
src/
  app/
    AppRoot.tsx
    ThemeProvider.tsx
  components/
    atoms/
      AppText.tsx
      IconButton.tsx
      PrimaryButton.tsx
    molecules/
      SearchBar.tsx
      SectionTitle.tsx
      SettingsRow.tsx
    organisms/
      ItemList.tsx
      EmptyState.tsx
      BottomActionBar.tsx
    layouts/
      Screen.tsx
      SafeScreen.tsx
  config/
    env.ts
    featureFlags.ts
  data/
    constants.ts
  navigation/
    AppNavigator.tsx
    routes.ts
  screens/
    HomeScreen.tsx
    CreateScreen.tsx
    DetailScreen.tsx
    SettingsScreen.tsx
  services/
    api.ts
    storage.ts
    permissions.ts
  store/
    useAppStore.ts
  theme/
    colors.ts
    typography.ts
    styles.ts
  types/
    navigation.ts
    icons.ts
  __tests__/
```

Rules:

- Keep navigation in `src/navigation`.
- Keep workflows and durable client state in `src/store`.
- Keep IO, native APIs, networking, persistence, and transformations in
  `src/services`.
- Keep screen files focused on composition and user events.
- Keep repeated UI in `components`, grouped by atoms, molecules, organisms, and
  layouts.
- Keep colors, spacing, typography, and reusable surfaces in `src/theme`.

## 4. App Root Pattern

Use a small root that wires providers, font loading, navigation, and theme:

```tsx
export function AppRoot() {
  const themeMode = useAppStore((state) => state.themeMode);
  const colors = useThemeColors(themeMode);

  return (
    <SafeAreaProvider>
      <ThemeProvider colors={colors}>
        <NavigationContainer theme={createNavigationTheme(colors)}>
          <AppNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

Do not put business logic in `App.tsx`. It should only register or render
`AppRoot`.

## 5. Navigation Standard

Use a root stack for full-screen workflows and tabs for top-level destinations.

Example:

```text
RootStack
  MainTabs
    Home
    Library
    Create
    Settings
  Edit
  Detail
  Confirmation
```

Guidelines:

- Use typed route params in `src/types/navigation.ts`.
- Avoid stringly typed navigation outside a central route type.
- Test important navigation buttons with React Native Testing Library and
  Maestro.
- Keep deep links for dev-only visual fixtures behind `__DEV__` flags.

## 6. State Management

Use Zustand for app workflows that span screens.

Store shape:

```ts
type AppState = {
  themeMode: "light" | "dark" | "system";
  locale: string;
  items: Item[];
  selectedItemId: string | null;
  setThemeMode: (mode: AppState["themeMode"]) => void;
  loadPersistedState: () => Promise<void>;
};
```

Rules:

- Keep state actions explicit and named by user intent.
- Keep expensive processing out of components.
- Persist only data that should survive app restarts.
- Gracefully handle persistence errors.
- Never store secrets in AsyncStorage.

## 7. Theme And UI System

Every app should start with:

- `src/theme/colors.ts`
- `src/theme/typography.ts`
- `src/theme/styles.ts`
- `AppText` atom
- `IconButton` atom
- `PrimaryButton` atom
- `Screen` layout wrapper
- `EmptyState` organism

Styling rules:

- Use `AppText` for visible app copy.
- Use named shared styles for repeated UI patterns.
- Inline styles are acceptable only for runtime-calculated values like measured
  width, drag coordinates, active opacity, image dimensions, or platform offsets.
- Support dark mode from day one.
- Use stable layout dimensions for toolbars, tab bars, cards, icon buttons, and
  grid items to avoid text/icon shifts.
- Avoid demo data in production flows. Empty state first, real data after user
  action.

## 8. Screen Design Rules

Home:

- Show the primary user outcome.
- Show only direct actions or clearly labelled navigation.
- Hide search when there is nothing to search.
- Use empty states instead of fake recent items.

Lists:

- Include empty state, loading state, error state, and populated state.
- Support filtering/search only when real data exists.
- Make row tap behavior obvious and tested.

Action Surfaces:

- If an action is shown as a shortcut, it should open the specific flow.
- If the flow is not built, put it behind `More`, `Coming Soon`, or remove it
  from the primary surface.

Settings:

- Persist user preferences.
- Use native switches for booleans.
- Use action sheets or modals for option sets.
- Keep permission and privacy text precise.

## 9. Permissions And Privacy

For every native permission:

- Add platform permission copy in `app.json`.
- Explain why the permission is needed at the moment of use.
- Handle denied, blocked, unavailable, and retry states.
- Do not log private local paths, user content, personal identifiers, tokens, or
  generated outputs in production logs.

Required release docs before store submission:

- Privacy policy
- Data deletion flow if accounts/cloud exist
- User data export flow if user content is stored remotely
- Permission rationale list

## 10. Testing Standard

Use the testing pyramid:

- Unit tests for services, formatting, reducers/actions, permissions, and data
  transforms.
- Component tests for shared atoms/molecules and screen contracts.
- Screen integration tests for navigation-visible behavior.
- Maestro tests for real click flows.
- Visual diffs for key surfaces.

Recommended scripts:

```json
{
  "typecheck": "tsc --noEmit",
  "typecheck:tests": "tsc --noEmit -p tsconfig.spec.json",
  "validate": "npm run typecheck && npm run typecheck:tests && npm run test:ci",
  "test": "jest --watchman=false --forceExit",
  "test:ci": "jest --runInBand --watchman=false --forceExit",
  "test:coverage": "jest --coverage --watchman=false",
  "e2e:maestro": "MAESTRO_PLATFORM=android node scripts/run-maestro.mjs maestro/flows",
  "e2e:maestro:ios": "MAESTRO_PLATFORM=ios node scripts/run-maestro.mjs maestro/flows",
  "visual:maestro": "node scripts/run-maestro.mjs maestro/visual/all-screens.yaml",
  "visual:maestro:ios": "MAESTRO_PLATFORM=ios node scripts/run-maestro.mjs maestro/visual/all-screens-ios.yaml",
  "visual:diff": "node scripts/compare-visuals.mjs",
  "visual:approve": "node scripts/approve-visuals.mjs",
  "visual:test": "npm run visual:maestro && npm run visual:diff",
  "release:test": "npm run validate && npm run e2e:maestro && npm run visual:test"
}
```

Component test rule:

- Not every tiny component needs a separate test file.
- Every reusable component with logic, state, accessibility behavior, important
  styling contract, or user interaction should have tests.
- Pure presentational components can be covered through screen tests if they are
  simple and stable.
- Shared components used across many screens deserve direct tests.

## 11. Maestro And Visual Diff Standard

Use Maestro for:

- App launch
- Tab navigation
- Core happy path
- Permission-denied path when possible
- Main settings toggles
- Import, creation, completion, or handoff flows where automation allows

Use visual diffs for:

- Home
- Main list/library
- Primary creation screen
- Edit/detail screen
- Confirmation/completion screen
- Settings
- Empty states
- Dark mode surfaces

Visual baseline rule:

- Review `visual-diffs/actual` manually before approving.
- Approve baselines only for intentional design changes.
- Do not approve a baseline to hide a bug.

## 12. Performance Guidelines

Build performance in from the first screen:

- Avoid large inline objects inside hot render paths.
- Memoize expensive derived lists with `useMemo`.
- Memoize callbacks only when they prevent real child rerenders.
- Keep media/assets sized and compressed before rendering large lists.
- Use `FlatList` for long lists.
- Use `ScrollView` only for short, bounded content.
- Avoid unnecessary global store subscriptions; select only the fields a
  component needs.
- Keep animations native-friendly and simple.
- Test on a real low/mid Android device before release.

## 13. New Architecture Policy

Choose explicitly per app:

```json
{
  "expo": {
    "newArchEnabled": true
  }
}
```

Default recommendation for new apps:

- Enable New Architecture early if dependencies support it.
- Keep it enabled only after verifying iOS and Android native builds.
- If Android shows a black screen or native crash, inspect logs and dependency
  compatibility before disabling.
- Document the decision in `README.md`.

Must-test flows under New Architecture:

- App launch
- Navigation
- Required native permissions
- Local storage or file operations if used
- Any platform handoff flow, such as share sheets, intents, links, or exports
- Native modules
- Dark mode
- Maestro smoke flow

## 14. Release Checklist

Before internal release:

```sh
npm run validate
npm run e2e:maestro
npm run visual:test
```

Also verify manually:

- iOS simulator
- Real iPhone if native permissions are involved
- Android emulator
- Real Android device before Play Store release
- Fresh install state
- Upgrade from previous build if app is already released
- Offline behavior
- Dark mode
- Large text / accessibility sizes
- Permission denied path
- Error states

Before store release:

- Bump app version.
- Bump iOS build number.
- Bump Android version code.
- Confirm production signing.
- Confirm privacy policy.
- Confirm no fake/demo data.
- Confirm no debug logs for private user content.
- Confirm release notes.
- Tag the release commit after upload is accepted.

## 15. Documentation To Keep In Every App

```text
README.md
PRD.md
docs/
  RELEASE_CHECKLIST.md
  ANDROID_RUNBOOK.md
  PRODUCTION_ROADMAP.md
rn-template.md
```

README should include:

- What the app does
- How to install
- How to run iOS/Android
- Useful scripts
- Architecture overview
- Styling guidelines
- Testing strategy
- Visual diff workflow
- New Architecture decision
- Release docs links

PRD should include:

- Problem
- Target users
- Core flows
- Feature scope
- Out of scope
- Non-functional requirements
- Privacy/security requirements
- Analytics/events if used
- Release milestones

## 16. App Creation Checklist

1. Create Expo TypeScript app.
2. Add navigation, safe area, theme provider, and app root.
3. Add folder structure from this template.
4. Add `AppText`, buttons, screen layout, and empty state components.
5. Add Zustand store and persistence wrapper.
6. Add first 3 screens: Home, primary workflow, Settings.
7. Add Jest config and base mocks.
8. Add tests for store, services, shared components, and Home.
9. Add Maestro launch/tab smoke flow.
10. Add visual screenshots and baseline scripts.
11. Add README, PRD, release checklist, and runbook.
12. Run `npm run validate`.
13. Run iOS and Android native builds.
14. Capture visual baseline only after manual review.

## 17. Definition Of Done

A feature is done only when:

- User flow works end to end.
- Empty/loading/error states are handled.
- Dark mode works.
- Accessibility labels are present for important controls.
- State is persisted if needed.
- Unit/component tests cover logic and interactions.
- Maestro covers the critical tap path if user-facing.
- Visual baseline is updated only for intentional UI changes.
- README or PRD is updated when behavior changes.
- `npm run validate` passes.
