# Android Runbook

## Requirements

- Android emulator or physical device
- JDK 17
- Node dependencies installed with `npm install`

## Run Debug Build

```sh
JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.18/libexec/openjdk.jdk/Contents/Home npm run android
```

If the app cannot reach Metro:

```sh
adb reverse tcp:8085 tcp:8085
```

## Usage Access

The phone usage feature requires Android Usage Access.

Manual path:

1. Open Aura Clock.
2. Tap `Allow` in `Phone usage`.
3. Enable usage access for Aura Clock in Android settings.
4. Return to the app and tap `Refresh`.

Emulator shortcut for verification:

```sh
adb shell appops set com.aura.clock GET_USAGE_STATS allow
```

## Known Build Note

Use JDK 17. JDK 25 triggered a native CMake/Gradle failure in this project.
