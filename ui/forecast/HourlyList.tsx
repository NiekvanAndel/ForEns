/**
 * The hour-by-hour list under a day sheet's chart.
 *
 * The web app prints one of these in every day popup, showing whichever measurand
 * the popup is about — millimetres in the precipitation popup, percent in the
 * humidity one, and so on. It is the part a reader scans for "when", which the chart
 * above can only suggest.
 *
 * One component covers every measurand rather than six near-copies, because six
 * near-copies is precisely how the web app's popups came to disagree with each
 * other. Hours already past are dimmed and labelled as measurements, not forecasts.
 *
 * Three-hourly samples beyond the deterministic run's hourly window are marked, so
 * a gap in the model is visible rather than implied.
 *
 * On precipitation the row also carries the hour's ensemble, once it has loaded: the
 * p10–p90 range the members allow, and the share of them that are wet at all. That
 * pair is what the web app's precipitation popup prints beside every hour, and it is
 * the difference between "1 mm" and "1 mm, but a third of the members say nothing".
 */
import { View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { WindArrow } from '../WindArrow';
import { usePrefs } from '../../state/prefs';
import { convTemp, convWind, fmtMm, t, tempUnitLabel, windUnitLabel } from '../../core/i18n';
import type { LayerKey } from '../../core/model/layers';
import type { DetailHour } from '../../core/model/dayDetail';

export interface HourlyListProps {
  layer: LayerKey;
  hours: DetailHour[];
  /** Named in the header, so it is clear which model the column came from. */
  sourceLabel: string;
}

export function HourlyList({ layer, hours, sourceLabel }: HourlyListProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  if (!hours.length) return null;

  // Only precipitation has a per-hour ensemble behind it, and only once it lands.
  const withEns = layer === 'precip' && hours.some((h) => h.ens);

  return (
    <View style={{ marginTop: space[4] }}>
      <Text variant="eyebrow" color={palette.muted} style={{ marginBottom: space[2] }}>
        {t('perHour', prefs.lang)} · {sourceLabel}
        {withEns ? ' · ENS' : ''}
      </Text>
      {hours.map((h, i) => (
        <View
          key={h.time}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space[3],
            paddingVertical: 8,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: palette.hairlineSoft,
            opacity: h.isPast ? 0.5 : 1,
          }}
        >
          <Text
            variant="label"
            weight="semibold"
            color={palette.muted}
            tabular
            style={{ width: 42 }}
          >
            {h.time.slice(11, 16)}
          </Text>

          <WeatherIcon wmo={h.wmo} isDay={hourIsDay(h)} size={20} />

          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6 }}>
            <HourValue layer={layer} hour={h} />
          </View>

          {withEns ? <EnsembleColumns hour={h} /> : null}

          {h.isPast ? (
            <Text variant="caption" color={palette.muted} style={{ fontSize: 10 }}>
              {t('measurement', prefs.lang)}
            </Text>
          ) : h.is3h ? (
            <Text variant="caption" color={palette.muted} style={{ fontSize: 10 }}>
              3u
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** What the 51 members say about this hour: the range they span, and how many of
 *  them are wet. Held to fixed widths so the column reads down. */
function EnsembleColumns({ hour }: { hour: DetailHour }) {
  const { palette } = useTheme();
  const e = hour.ens;
  return (
    <>
      <Text
        variant="caption"
        color={palette.muted}
        tabular
        align="right"
        style={{ width: 74, fontSize: 11 }}
      >
        {e ? `(${fmtMm(e.precipP10)}–${fmtMm(e.precipP90)})` : ''}
      </Text>
      <Text
        variant="caption"
        weight="bold"
        color={e && e.pChance >= 40 ? palette.valPrecip : palette.muted}
        tabular
        align="right"
        style={{ width: 34, fontSize: 12 }}
      >
        {e ? `${Math.round(e.pChance)}%` : ''}
      </Text>
    </>
  );
}

/** Day or night for the icon. The hour already knows its own date, and the sheet
 *  never crosses a location, so the model's own flag is enough. */
function hourIsDay(h: DetailHour): 0 | 1 {
  const hour = h.hour;
  return hour >= 6 && hour < 21 ? 1 : 0;
}

/** The one number this list is about. */
function HourValue({ layer, hour }: { layer: LayerKey; hour: DetailHour }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  switch (layer) {
    case 'precip':
      return (
        <Pair
          value={fmtMm(hour.precip)}
          unit="mm"
          color={hour.precip > 0 ? palette.valPrecip : palette.valPrecipZero}
        />
      );

    case 'temp':
      return (
        <Pair
          value={convTemp(hour.temp, prefs.tempUnit)}
          unit={tempUnitLabel(prefs.tempUnit)}
          color={palette.valTemp}
        />
      );

    case 'wind':
      return (
        <>
          <WindArrow deg={hour.windDir} size={11} color={palette.muted} />
          <Pair
            value={convWind(hour.wind, prefs.windUnit)}
            unit={windUnitLabel(prefs.windUnit)}
            color={palette.valWind}
          />
          {hour.gusts != null ? (
            <Text variant="caption" color={palette.muted} tabular style={{ fontSize: 11 }}>
              ⤴ {convWind(hour.gusts, prefs.windUnit)}
            </Text>
          ) : null}
        </>
      );

    case 'sun':
      return (
        <Pair
          value={hour.sunMin != null ? Math.round(hour.sunMin) : null}
          unit="min"
          color={palette.valSun}
        />
      );

    case 'humidity':
      return (
        <Pair
          value={hour.humidity != null ? Math.round(hour.humidity) : null}
          unit="%"
          color={palette.accentDark}
        />
      );

    // The overview list carries the whole hour, since that is what it is for.
    case 'overview':
      return (
        <>
          <Pair
            value={convTemp(hour.temp, prefs.tempUnit)}
            unit={tempUnitLabel(prefs.tempUnit)}
            color={palette.valTemp}
          />
          <Pair
            value={fmtMm(hour.precip)}
            unit="mm"
            color={hour.precip > 0 ? palette.valPrecip : palette.valPrecipZero}
          />
          <Pair
            value={convWind(hour.wind, prefs.windUnit)}
            unit={windUnitLabel(prefs.windUnit)}
            color={palette.muted}
          />
        </>
      );
  }
}

function Pair({
  value, unit, color,
}: { value: string | number | null; unit: string; color: string }) {
  const { palette } = useTheme();
  if (value == null) {
    return (
      <Text variant="label" color={palette.inkDisabled} tabular>
        —
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text variant="label" weight="bold" color={color} tabular>
        {value}
      </Text>
      <Text variant="caption" weight="semibold" color={palette.muted} style={{ fontSize: 10 }}>
        {' '}{unit}
      </Text>
    </View>
  );
}
