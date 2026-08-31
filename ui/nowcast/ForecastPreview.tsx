/**
 * The forecast preview card: an hourly strip and the first four days.
 *
 * The day bar spans that day's min to max temperature, positioned inside the range
 * of all days shown — so a cold day sits left and a warm one right, and the bars are
 * comparable down the column rather than each filling its own row.
 */
import { View, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, space, useTheme } from '../../theme';
import { Card, CardHeader, Rule } from '../Card';
import { Text } from '../Text';
import { WeatherIcon } from '../WeatherIcon';
import { usePrefs } from '../../state/prefs';
import { convTemp, fmtMm, dayNames, ta } from '../../core/i18n';
import type { Day, ForecastModel } from '../../core/model/types';

export function ForecastPreview({
  model, onOpen,
}: { model: ForecastModel; onOpen: () => void }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const hours = model.futureHours.slice(0, 12);
  const days = model.days.slice(0, 4);
  const maxMm = Math.max(...hours.map((h) => h.precip ?? 0), 1);

  // One shared temperature range, so the bars can be read against each other.
  const lows = days.map((d) => d.hresTempMin ?? d.tempLo).filter((v): v is number => v != null);
  const highs = days.map((d) => d.hresTempMax ?? d.tempHi).filter((v): v is number => v != null);
  const range = {
    lo: lows.length ? Math.min(...lows) : 0,
    hi: highs.length ? Math.max(...highs) : 1,
  };

  return (
    <Card>
      <CardHeader icon="clock" label={ta('tabForecast', prefs.lang)} action={ta('details', prefs.lang)} onAction={onOpen} />
      <Pressable onPress={onOpen} accessibilityRole="button">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
        >
          {hours.map((h, i) => {
            const mm = h.precip ?? 0;
            return (
              <View
                key={h.time}
                style={{
                  width: 62, alignItems: 'center', borderRadius: radius.tile + 2,
                  paddingVertical: 10, paddingHorizontal: 4,
                  backgroundColor: i === 0 ? palette.skyWash : 'transparent',
                }}
              >
                <Text variant="caption" weight="semibold" color={palette.muted} tabular>
                  {h.time.slice(11, 16)}
                </Text>
                <View style={{ marginVertical: 7 }}>
                  <WeatherIcon wmo={h.wmo} isDay={h.isDay} size={22} />
                </View>
                <Text variant="bodySm" weight="bold" color={palette.valTemp} tabular>
                  {convTemp(h.temp, prefs.tempUnit) ?? '—'}°
                </Text>
                <View style={{ height: 30, justifyContent: 'flex-end', marginTop: 6 }}>
                  {mm > 0 ? (
                    <LinearGradient
                      colors={[palette.sky, palette.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={{ width: 16, height: Math.max(3, (mm / maxMm) * 30), borderRadius: 3 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 16, height: 3, borderRadius: 3,
                        backgroundColor: palette.hairline,
                      }}
                    />
                  )}
                </View>
                <Text
                  variant="caption"
                  weight="bold"
                  tabular
                  color={mm > 0 ? palette.valPrecip : palette.valPrecipZero}
                  style={{ fontSize: 11, marginTop: 5 }}
                >
                  {fmtMm(mm)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </Pressable>

      <Rule style={{ marginTop: space[3] }} />
      <View style={{ paddingTop: space[3], gap: 2 }}>
        {days.map((d) => (
          <DayRow key={d.date} day={d} range={range} lang={prefs.lang} />
        ))}
      </View>
    </Card>
  );
}

export function DayRow({
  day, range, lang, onPress,
}: {
  day: Day;
  range: { lo: number; hi: number };
  lang: Parameters<typeof dayNames>[0];
  onPress?: () => void;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const lo = day.hresTempMin ?? day.tempLo;
  const hi = day.hresTempMax ?? day.tempHi;
  const span = range.hi - range.lo || 1;
  const left = lo != null ? ((lo - range.lo) / span) * 100 : 0;
  const width = lo != null && hi != null ? ((hi - lo) / span) * 100 : 0;

  const date = new Date(day.date + 'T12:00:00Z');
  const names = dayNames(lang);

  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 2 }}>
      <View style={{ width: 44 }}>
        <Text variant="label" weight="bold" color={palette.inkHeading}>
          {names[date.getUTCDay()]}
        </Text>
        <Text variant="caption" color={palette.muted} style={{ fontSize: 11 }} tabular>
          {date.getUTCDate()}/{date.getUTCMonth() + 1}
        </Text>
      </View>
      <WeatherIcon wmo={day.dayIcon ?? day.wmo} isDay={1} size={19} />
      <Text variant="label" weight="bold" color={palette.valLow} tabular align="right" style={{ width: 30 }}>
        {convTemp(lo, prefs.tempUnit) ?? '—'}°
      </Text>
      <View
        style={{
          flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.hairline,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[palette.valLow, palette.valTemp]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${left}%`, width: `${Math.max(2, width)}%`, borderRadius: 3,
          }}
        />
      </View>
      <Text variant="label" weight="bold" color={palette.valHigh} tabular style={{ width: 30 }}>
        {convTemp(hi, prefs.tempUnit) ?? '—'}°
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}
