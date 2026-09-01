# App icons

`app.json` points at these directly, so there is no second copy to keep in step.

| File | Used as | Which is it |
| --- | --- | --- |
| `exactcast-icon-radar-light.png` | the default icon, and the widget's | navy cloud on cream |
| `exactcast-icon-radar.png` | the dark home screen (iOS 18+) | cream cloud on navy |

`light` and `dark` name the *home screen's* appearance, not the artwork's — the icon
shown on a light home screen is the one with the light background. Easy to invert,
and nothing warns you if you do.

Run `npm run check:icons` before a build. It reads the PNG headers and checks the
two things that otherwise surface twenty minutes in, or at submission.

## Rules Apple enforces

- **1024×1024**, square. Every other size is generated from it. Both are.
- **The default icon must have no alpha channel** — a submission carrying one is
  rejected, and iOS applies the rounded corner itself. Both files are opaque RGB,
  so this is already right.
- **The dark variant may carry transparency**, and gains something by it: iOS
  composites the dark icon over its own backdrop. Ours is flattened onto navy
  instead, which is a deliberate, self-contained look rather than a mistake.
- **No rounded corners of your own.** iOS masks the square; corners in the artwork
  come out doubly rounded.

## Not supplied

A **tinted** variant, for the iOS 18 monochrome home screen. It should be greyscale
with the subject light and the background dark, since iOS colourises it against the
user's tint. Without one, iOS derives its own from the default icon, which for this
mark is acceptable. To add it, drop the file in and add
`"tinted": "./logos/<name>.png"` to `ios.icon` in `app.json` — a path pointing at a
missing file fails the prebuild, which is why it is not listed pre-emptively.

## Splash screen

Not wired up. To add one, put `expo-splash-screen` in the `plugins` array:

```json
[
  "expo-splash-screen",
  {
    "image": "./logos/exactcast-icon-radar-light.png",
    "imageWidth": 200,
    "resizeMode": "contain",
    "backgroundColor": "#F4EEE3",
    "dark": {
      "image": "./logos/exactcast-icon-radar.png",
      "backgroundColor": "#0A1936"
    }
  }
]
```

The two colours are the design system's cream and navy, so the splash matches the
app's own ground in both appearances.
