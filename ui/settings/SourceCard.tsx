/**
 * Which model spoke, per horizon.
 *
 * This lived at the bottom of the forecast page, under the fourteen-day list — a
 * card about provenance sitting where a reader goes to read a forecast. It is
 * reference material, so it belongs in settings, beside the switch that decides
 * whether HARMONIE is used at all.
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Card, CardHeader } from '../Card';
import { Text } from '../Text';
import { usePrefs } from '../../state/prefs';
import { useForecast } from '../../state/forecast';
import { ta } from '../../core/i18n';

export function SourceCard() {
  const { prefs, location } = usePrefs();
  const { model, harmonie } = useForecast();

  const modelLabel = model?.hresRunLabel ? `ECMWF ${model.hresRunLabel}` : 'ECMWF IFS';
  const midTerm = harmonie.model
    ? `HARMONIE-AROME ${harmonie.model === 'netherlands' ? 'NL' : 'EU'}`
    : 'ECMWF IFS';

  return (
    <Card>
      <CardHeader icon="info" label={ta('source', prefs.lang)} />
      <View style={{ gap: 10 }}>
        <SourceRow
          label={ta('shortTerm', prefs.lang)}
          value={
            ta('nowcastRadar', prefs.lang) +
            (location.stationId ? ta('withStation', prefs.lang) : '')
          }
        />
        <SourceRow label={ta('midTerm', prefs.lang)} value={midTerm} />
        <SourceRow
          label={ta('longTerm', prefs.lang)}
          value={`${modelLabel}${model && model.nMembers > 1 ? ` · ${model.nMembers} leden` : ''}`}
          last
        />
      </View>
    </Card>
  );
}

function SourceRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'space-between',
        gap: space[4], alignItems: 'baseline',
        paddingBottom: last ? 0 : space[2],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.hairlineSoft,
      }}
    >
      <Text variant="label" weight="regular" color={palette.muted} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text
        variant="label"
        weight="bold"
        color={palette.inkHeading}
        align="right"
        style={{ flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );
}
