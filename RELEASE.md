# Getting ExactCast AI onto TestFlight

The app has no `ios/` directory in the repository — it is a prebuild project, so the
Xcode project is generated from `app.json` and the target config each time. That means
a release is not "open Xcode and archive"; it is **EAS Build** producing the `.ipa` on
a hosted Mac, and **EAS Submit** handing it to App Store Connect, which then makes it
available in TestFlight.

`eas.json` in the repository root carries the build and submit profiles. Everything
below that touches Apple has to be done by a person with the Apple account — no build
config can stand in for it.

---

## What only you can do

These are prerequisites, not steps the tooling can work around.

1. **An Apple Developer Program membership** for AgroExact — €99/year, and enrolment as
   an organisation takes a few days because Apple verifies the company (a D-U-N-S
   number is part of it). An Individual membership is quicker but puts a person's name
   on the App Store listing rather than the company's.
2. **An App Store Connect account** on that team, with the **App Manager** role at
   least. Account Holder or Admin is needed for the one-off key in step 4.
3. **An Expo account**, and the project linked to it. On the first `eas build` the CLI
   asks; it writes `extra.eas.projectId` into `app.json`, which should be committed.
4. **An App Store Connect API key**, if builds are ever to be submitted without a human
   at the keyboard — see *Submitting from CI* below. For submitting by hand, signing in
   with an Apple ID and an app-specific password is enough.

## The two bundle identifiers

The app ships as two signed things, and both have to exist on the Apple side:

| | Identifier | What it is |
| --- | --- | --- |
| App | `com.agroexact.exactcast` | declared in `app.json` |
| Widget extension | `com.agroexact.exactcast.widget` | declared in `targets/widget/expo-target.config.js` |

Both need the **App Groups** capability carrying `group.com.agroexact.exactcast` — that
shared container is how the app hands the widget its forecast (`state/widgetSync.ts`,
`targets/widget/Payload.swift`). EAS registers the identifiers, creates the App Group
and issues both provisioning profiles on the first production build; it prompts before
it does. `@bacons/apple-targets` writes the extension into the Expo config during
prebuild, so EAS knows it needs a second profile without anything being listed twice.

Nothing else in `app.json` needs a capability Apple has to approve. Location is a usage
string, not an entitlement; background fetch and processing likewise; push is declared
but `enableBackgroundRemoteNotifications` is off and the notification surface is hidden
(see `DEFERRED.md`), so no APNs key is required to ship.

## First release, step by step

```bash
npm ci
npm run check:icons      # dimensions and alpha — Apple rejects on both
npm run typecheck && npm run lint && npm test

npm i -g eas-cli         # or use npx eas-cli throughout
eas login
eas build:configure      # links the project, writes extra.eas.projectId
```

Commit the `projectId` change, then:

```bash
eas build --platform ios --profile production
```

This prompts for the Apple credentials, creates the identifiers, App Group and
provisioning profiles, and builds on a hosted macOS runner. Twenty to forty minutes is
normal for a first build. When it finishes:

```bash
eas submit --platform ios --profile production --latest
```

If the app does not exist in App Store Connect yet, EAS creates the record using the
`submit.production.ios` block in `eas.json` (name, company, primary language, SKU).
Apple then processes the build for ten to thirty minutes before it appears under
**TestFlight → iOS Builds**.

## Before testers can install it

TestFlight will not hand a build to anyone until two things are answered in App Store
Connect, and both are one-off:

- **Export compliance.** `ios.config.usesNonExemptEncryption` is already `false` in
  `app.json`, so the per-build question is answered automatically and no yearly
  self-classification report is owed.
- **Test information** — a contact email and, for external testers, a description of
  what to test. Internal testers (up to 100 people holding a role on the App Store
  Connect team) get the build immediately with no review. External testers, up to
  10,000 by email or public link, need a one-time **Beta App Review**, usually a day or
  so. Start internal; move to external when the build is worth strangers' time.

Add testers under **TestFlight → Internal Testing**, create a group, add the build.

## Every release after the first

```bash
npm run check:icons && npm run typecheck && npm run lint && npm test
eas build --platform ios --profile production --auto-submit
```

`--auto-submit` runs the submit step when the build succeeds, so it is one command.

Version numbers are split deliberately. The **marketing version** — `expo.version` in
`app.json`, currently `0.1.0` — is yours to bump when a release means something, and it
lives in git. The **build number** is held by EAS (`cli.appVersionSource: "remote"`) and
incremented on every production build by `autoIncrement`, because App Store Connect
rejects a build number it has already seen and keeping that count in the repository
invites merge conflicts over a number nobody reads. `eas build:version:get` shows where
it stands.

## The other build profiles

| Profile | Distribution | For |
| --- | --- | --- |
| `development` | internal | dev-client build on a registered device, with Metro attached |
| `simulator` | internal | the same, for the iOS Simulator, no signing |
| `preview` | internal | a release build installed straight onto registered devices, no App Store Connect round trip |
| `production` | store | TestFlight and the App Store |

`preview` is the fast lane for showing someone a change — `eas device:create` registers
their iPhone, and the build installs from a link. It skips Apple entirely, at the cost
of having to know the device in advance.

## Submitting from CI

`.github/workflows/testflight.yml` runs the same two commands on demand. It is manual
(`workflow_dispatch`) rather than on push — a TestFlight build costs build minutes and a
build number, so it should be a decision. It needs two repository secrets:

- `EXPO_TOKEN` — a robot access token from **expo.dev → account settings → access
  tokens**.
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD` — or, better, an **App Store Connect API key**
  (`.p8`) uploaded once with `eas credentials`, which then needs no secret in GitHub at
  all and does not expire when someone's Apple password changes.

## Worth knowing before you invite anyone

**The deployment target is iOS 26.** `app.json` sets it, because the interface leans on
Liquid Glass (`expo-glass-effect`) and on SF Symbols that predate nothing older. A
tester on iOS 18 will not see the build in TestFlight at all — it is filtered out
silently, which reads as "it never arrived". Say so when you invite people.

**There is no splash screen.** Expo's default white screen shows on launch.
`logos/README.md` has the configuration to paste in, using the icons already in the
repository. Not a blocker for TestFlight; noticeable on the App Store.

**Builds expire after 90 days**, and testers get pushed off them. A TestFlight round is
a quarter at most, not indefinite.
