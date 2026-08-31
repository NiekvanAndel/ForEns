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
  // No icon is set: design rule 4 states there is no logo and that one must never
  // be drawn or approximated, so the widget inherits the app icon until a real
  // asset is supplied.
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
  },
};
