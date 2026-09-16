/**
 * The alerts a grower set themselves, as a list.
 *
 * Made from a block on 'Actueel' — see `TileAlertForm` — and kept here, because a
 * list of rules belongs with the other notification settings and not on the page the
 * weather is on.
 *
 * Each row is the rule as a sentence: what, which way, which figure, and where. The
 * figure is drawn in the reader's current units rather than the ones it was typed in,
 * so a rule set in Celsius reads correctly after somebody switches to Fahrenheit —
 * that is the whole reason the threshold is stored canonical.
 *
 * The block's title comes from the rule rather than from the live grid. It has to: a
 * rule can name a block for a quantity this location has nothing to say about, and
 * one made before a block was renamed should still read as what it was made from.
 */
import { View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { Toggle } from './Controls';
import { usePrefs } from '../../state/prefs';
import { removeAlert, setAlertEnabled, type UserAlert } from '../../core/alerts';
import {
  convTempExact, convWindExact, fmtMm, ta, tempUnitLabel, windUnitLabel,
} from '../../core/i18n';
import type { Prefs } from '../../core/prefs';

/** The threshold as the reader would read it today, unit and all. */
export function alertValueLabel(alert: UserAlert, prefs: Prefs): string {
  switch (alert.kind) {
    case 'temp': {
      const v = convTempExact(alert.value, prefs.tempUnit) ?? alert.value;
      return `${round1(v)} ${tempUnitLabel(prefs.tempUnit)}`;
    }
    case 'wind': {
      const v = convWindExact(alert.value, prefs.windUnit) ?? alert.value;
      return `${round1(v)} ${windUnitLabel(prefs.windUnit, prefs.lang)}`;
    }
    case 'mm':
      return `${fmtMm(alert.value)} mm`;
    case 'percent':
      return `${Math.round(alert.value)} %`;
    case 'direction':
      return `${Math.round(alert.value)}°`;
  }
}

const round1 = (v: number): string =>
  (Math.round(v * 10) / 10).toString().replace('.', ',');

export function UserAlertList() {
  const { palette } = useTheme();
  const { prefs, setPref } = usePrefs();
  const alerts = prefs.userAlerts;

  if (!alerts.length) {
    return (
      <View style={{ paddingVertical: space[5], paddingHorizontal: space[5] }}>
        <Text variant="bodySm" color={palette.muted}>
          {ta('alertNone', prefs.lang)}
        </Text>
      </View>
    );
  }

  return (
    <>
      {alerts.map((alert, i) => (
        <View
          key={alert.id}
          style={{
            paddingVertical: space[4], paddingHorizontal: space[5],
            borderBottomWidth: i === alerts.length - 1 ? 0 : 1,
            borderBottomColor: palette.hairlineSoft,
            gap: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" weight="semibold" color={palette.inkHeading} numberOfLines={1}>
                {alert.title}
                <Text variant="caption" color={palette.muted}>
                  {alert.timeLabel ? ` · ${alert.timeLabel}` : ''}
                </Text>
              </Text>
              <Text variant="bodySm" color={palette.ink}>
                {`${ta(alert.op === 'above' ? 'alertAbove' : 'alertBelow', prefs.lang)} `}
                <Text variant="bodySm" weight="bold" color={palette.inkHeading} tabular>
                  {alertValueLabel(alert, prefs)}
                </Text>
              </Text>
            </View>

            <Toggle
              on={alert.enabled}
              onChange={(v) => {
                Haptics.selectionAsync().catch(() => {});
                setPref('userAlerts', setAlertEnabled(alerts, alert.id, v));
              }}
              label={alert.title}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            {/* Named rather than counted. "3 stations" is a number somebody then has
                to open the rule to understand; the names are what they picked. */}
            <Text
              variant="caption"
              color={palette.muted}
              numberOfLines={1}
              style={{ flexShrink: 1, flexGrow: 1 }}
            >
              {alert.stationNames.join(' · ') || alert.stationIds.join(' · ')}
            </Text>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPref('userAlerts', removeAlert(alerts, alert.id));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${ta('alertDelete', prefs.lang)}: ${alert.title}`}
              hitSlop={10}
              style={{ paddingLeft: space[3] }}
            >
              <Icon name="trash" size={15} color={palette.muted} />
            </Pressable>
          </View>
        </View>
      ))}
    </>
  );
}
