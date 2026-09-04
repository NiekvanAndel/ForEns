/**
 * ESLint, flat config.
 *
 * `npm run lint` had no configuration at all to find: the script was there, the
 * dependency was not, and ESLint 9 stopped reading `.eslintrc.*` — so the command
 * failed before it looked at a single file.
 *
 * The base is Expo's own config, which is the one that knows what React Native is:
 * JSX, hooks, unused imports, and the platform-suffixed modules a plain import
 * resolver cannot follow. On top of it: exhaustive hook dependencies, which Expo
 * leaves off and this codebase cannot do without, and the React Compiler rules
 * switched off with the reasons written down. Nothing here argues about
 * formatting, which is not what a linter is for.
 *
 * `iOS/` is ignored. It is the design system the app was built from — a folder of
 * web components kept for reference, not code that ships.
 */
const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'iOS/**',
      'android/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'targets/**',
      'index.html',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      // The staged loads and the pager cache are held together by effect
      // dependencies; a missing one is a page that never updates. Expo's base
      // leaves this off, which is the one thing this codebase cannot afford.
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',

      // The React Compiler rules that ship with the hooks plugin are off. They
      // describe a codebase this one is not, and every report they make here is
      // about a pattern that is deliberate:
      //
      //  - `immutability` and `refs` fire on Reanimated shared values and on the
      //    gesture handlers that write them, which is how Reanimated works.
      //  - `set-state-in-effect` fires on the staged forecast load, where an
      //    effect is exactly the right place to mirror an external system into
      //    state as each stage lands.
      //  - `purity` fires on `Date.now()` read while rendering a clock, which is
      //    the value the clock is for.
      //
      // Turning them off is a judgement about this codebase, not about the rules;
      // they are worth revisiting if it ever adopts the compiler.
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    // Node scripts and config, not app code.
    files: ['scripts/**/*.{js,mjs}', 'eslint.config.js', 'babel.config.js', '*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        require: 'readonly', module: 'writable', process: 'readonly',
        __dirname: 'readonly', Buffer: 'readonly', console: 'readonly',
      },
    },
  },
];
