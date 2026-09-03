# Kasama docs

The [README](../README.md) covers what Kasama is, how to run it and how to use it. These are
the longer notes behind it — why things are built the way they are, and the work that isn't
part of everyday development.

| Doc | What's in it |
| --- | --- |
| [Architecture](architecture.md) | Where the code lives, how a second person gets into a household, what the tab bar knows, and how realtime updates work |
| [Data model](data-model.md) | Every table and storage bucket, row level security, and what happens when somebody leaves or signs out |
| [Design system](design-system.md) | "The shared fridge board" — colour and type tokens, motion, why every screen draws its own header, the icon set, text scaling |
| [Push notifications](push-notifications.md) | The three kinds of push, the Edge Functions that send them, and the daily "due tomorrow" digest |
| [Development](development.md) | Running over USB in full, troubleshooting Expo Go, resetting data and storage, and the database and function test suites |
| [Running on iOS, locally](ios-local.md) | Getting the app onto an iPhone or a simulator for your own use — Expo Go, the simulator, and the two ways to install a build on the phone |
| [Releasing](releasing.md) | EAS setup and everything the App Store and Play Store need |
| [Known limitations](limitations.md) | An identity lives on one device, a share is all-or-nothing, and what isn't built yet |
