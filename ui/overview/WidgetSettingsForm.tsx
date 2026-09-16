/**
 * What one overview widget is set to.
 *
 * A face of the arrangement sheet rather than a sheet of its own. Presenting a modal
 * in the same frame another is dismissed in does not reliably survive it on iOS — the
 * alert form on 'Actueel' learned that — and a widget's settings are reached from the
 * editor, which is already a modal. So the editor swaps its list for this, and there
 * is one sheet on screen throughout.
 *
 * ## Three controls, and no more
 *
 * A widget declares which of `location`, `limit` and `window` it accepts, and this
 * draws those. That is a deliberate ceiling: a settings screen that can render any
 * shape a widget invents is a settings screen nobody can keep consistent, and a
 * widget wanting a fourth kind of control has to add it here, where the cost is
 * visible. See `WidgetSettings`.
 *
 * ## Nothing is written until it differs
 *
 * `setWidgetSetting` forgets a value set back to its default, so a reader who tries
 * a setting and puts it back ends up exactly where somebody who never opened this is
 * — including when the app later thinks better of that default.
 */
import { Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import {
  OVERVIEW_WIDGETS, WIDGET_OPTION_CHOICES, setWidgetSetting, widgetSettings,
  type WidgetOptionKey, type WidgetSettings,
} from '../../core/overview';
import { ta } from '../../core/i18n';

export interface WidgetSettingsFormProps {
  /** The widget being set up. */
  id: string;
  /** Its name, for the heading — the page owns the label table. */
  title: string;
}

export function WidgetSettingsForm({ id, title }: WidgetSettingsFormProps) {
  const { palette } = useTheme();
  const { prefs, setPrefs } = usePrefs();

  const widget = OVERVIEW_WIDGETS.find((w) => w.id === id);
  const options: readonly WidgetOptionKey[] = widget?.options ?? [];
  const settings = widgetSettings(prefs.overviewSettings, id);

  const write = <K extends WidgetOptionKey>(key: K, value: WidgetSettings[K]) => {
    Haptics.selectionAsync().catch(() => {});
    setPrefs({ overviewSettings: setWidgetSetting(prefs.overviewSettings, id, key, value) });
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: space[5], paddingVertical: space[4], gap: space[5] }}>
        <Text variant="caption" color={palette.muted}>
          {ta('wsFor', prefs.lang).replace('{w}', title)}
        </Text>

        {options.includes('location') ? (
          <Field label={ta('wsLocation', prefs.lang)} hint={ta('wsLocationHint', prefs.lang)}>
            {/* "Follow the selection" first and unnumbered, because it is what the
                widget does now and what most readers want: the page they open moves
                with them. Pinning is the exception, so it reads as one. */}
            <Choice
              label={ta('wsFollow', prefs.lang)}
              on={settings.location == null}
              onPress={() => write('location', undefined)}
              wide
            />
            {prefs.locations.map((l, i) => (
              <Choice
                key={`${l.lat},${l.lon},${i}`}
                label={l.name}
                on={settings.location === i}
                onPress={() => write('location', i)}
                wide
              />
            ))}
          </Field>
        ) : null}

        {options.includes('limit') ? (
          <Field label={ta('wsLimit', prefs.lang)} hint={ta('wsLimitHint', prefs.lang)}>
            {WIDGET_OPTION_CHOICES.limit.map((n) => (
              <Choice
                key={n}
                label={String(n)}
                on={settings.limit === n}
                onPress={() => write('limit', n)}
              />
            ))}
          </Field>
        ) : null}

        {options.includes('hours') ? (
          <Field label={ta('wsHours', prefs.lang)}>
            {WIDGET_OPTION_CHOICES.hours.map((n) => (
              <Choice
                key={n}
                label={`${n} ${ta('ovHours', prefs.lang)}`}
                on={settings.hours === n}
                onPress={() => write('hours', n)}
              />
            ))}
          </Field>
        ) : null}

        {options.includes('window') ? (
          <Field label={ta('wsWindow', prefs.lang)}>
            {WIDGET_OPTION_CHOICES.window.map((w) => (
              <Choice
                key={w}
                label={ta(w === 'today' ? 'today' : 'last24h', prefs.lang)}
                on={settings.window === w}
                onPress={() => write('window', w)}
              />
            ))}
          </Field>
        ) : null}

        {options.length ? null : (
          <Text variant="bodySm" color={palette.muted}>
            {ta('wsNone', prefs.lang)}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

/** A labelled group of choices. */
function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" weight="bold" color={palette.inkHeading}>
        {label}
      </Text>
      {hint ? (
        <Text variant="caption" color={palette.muted}>
          {hint}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View>
    </View>
  );
}

/** One choice: a pill that is either on or off. `wide` is for names, which do not
 *  fit the width a number does. */
function Choice({
  label, on, onPress, wide,
}: { label: string; on: boolean; onPress: () => void; wide?: boolean }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        minWidth: wide ? undefined : 52,
        justifyContent: 'center',
        paddingVertical: 9, paddingHorizontal: space[4],
        borderRadius: radius.pill,
        backgroundColor: on ? palette.accent : palette.surfaceAlt,
      }}
    >
      {on ? <Icon name="check" size={12} color={palette.appCard} weight="bold" /> : null}
      <Text
        variant="bodySm"
        weight="semibold"
        color={on ? palette.appCard : palette.ink}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
