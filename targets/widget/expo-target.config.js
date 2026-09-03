/**
 * The WidgetKit target.
 *
 * @bacons/apple-targets generates the Xcode target from this on `expo prebuild`.
 * The App Group is mirrored automatically from `ios.entitlements` in app.json, so
 * the identifier is declared in one place only.
 */
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'ExactCast',
  // The widget shares the app's icon. It only appears in the widget gallery, where
  // a mark distinct from the app's would make the widget harder to find, not easier.
  icon: '../../logos/exactcast-icon-radar-light.png',
  colors: {
    // Referenced from Swift as Color("WidgetBackground"), so the widget picks up
    // the design system's cream and navy without hard-coding hex in two places.
    WidgetBackground: { light: '#F4EEE3', dark: '#0A1936' },
    WidgetCard: { light: '#FFFFFF', dark: '#0C2547' },
    WidgetInk: { light: '#0C2547', dark: '#FFFFFF' },
    WidgetMuted: { light: '#4F6885', dark: '#B9C7D6' },
    WidgetAccent: { light: '#1C93C4', dark: '#5FA3CE' },
    WidgetHigh: { light: '#D0524E', dark: '#E8817D' },
    WidgetLow: { light: '#2E7BC4', dark: '#6FAEE8' },
    WidgetSun: { light: '#D9871F', dark: '#E8A94E' },
    WidgetAgro: { light: '#457A3D', dark: '#8FC983' },

    // The weather glyphs, one colour per layer — the same set the app states in
    // core/model/conditions.ts. Only the cloud differs between appearances; the sun,
    // the rain and the lightning hold their own against either ground. Snow has no
    // colour of its own: it takes the cloud's, so a snow glyph reads as one object.
    WidgetGlyphCloud: { light: '#B7C3D1', dark: '#C9D6E4' },
    WidgetGlyphSun: { light: '#FFCC00', dark: '#FFCC00' },
    WidgetGlyphPrecip: { light: '#3FC1EF', dark: '#3FC1EF' },
    WidgetGlyphStorm: { light: '#D9871F', dark: '#D9871F' },
  },
};
