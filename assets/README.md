# App icons

Drop the exported icons here. Nothing else in the project needs changing —
`app.json` already points at these paths, and `npm run check:icons` will tell you
whether they are valid before a build finds out the slow way.

| File | Required | What it is |
| --- | --- | --- |
| `icon.png` | yes | The default icon — **the cream one**, navy cloud on cream. |
| `icon-dark.png` | no | Dark home screen (iOS 18+) — **the navy one**, cream cloud. |
| `icon-tinted.png` | no | Greyscale source for the tinted home screen (iOS 18+). |

The mapping is worth getting right and is easy to invert: `light` and `dark` name
the *home screen's* appearance, not the artwork's. The icon shown on a light home
screen is the one with the light background.

## Rules Apple enforces

- **1024×1024**, square. Every other size is generated from it.
- **`icon.png` must have no alpha channel.** A submission with one is rejected, and
  iOS applies the rounded corner itself. Export it flattened.
- **`icon-dark.png` and `icon-tinted.png` want the opposite**: iOS composites those
  over its own backdrop, so they should carry transparency where the backdrop should
  show through. A flattened dark icon still works — it simply hides the system's
  backdrop rather than sitting on it.
- **No rounded corners of your own.** iOS applies the mask; corners baked into the
  artwork end up doubly rounded.
- Keep anything important away from the outer ~10%, which the mask eats.

`icon-tinted.png` should be greyscale with the *subject* light and the background
dark — iOS colourises it against the user's chosen tint. A tinted icon exported as
a normal colour image comes out muddy. Nothing references it yet: add
`"tinted": "./assets/icon-tinted.png"` to `ios.icon` in `app.json` once it exists,
since a path pointing at a missing file fails the prebuild.

## Splash screen

Not wired up. If you want one, add `expo-splash-screen` to the `plugins` array in
`app.json`:

```json
[
  "expo-splash-screen",
  {
    "image": "./assets/splash-icon.png",
    "imageWidth": 200,
    "resizeMode": "contain",
    "backgroundColor": "#F4EEE3",
    "dark": { "backgroundColor": "#0A1936" }
  }
]
```

The two colours are the design system's cream and navy, so the splash matches the
app's ground in both appearances.
