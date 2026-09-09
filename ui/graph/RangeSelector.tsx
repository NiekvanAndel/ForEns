/**
 * The period the graph covers: four presets, or two dates.
 *
 * The presets are whole days counted back from today, because the API's window is
 * day-granular — asking for "the last 48 hours" and drawing a chart labelled with
 * dates would be inventing a precision the request does not have.
 *
 * Pressing a preset and picking a date are the same act to the reader, so they are
 * the same control: choosing a date drops the preset highlight, and choosing a
 * preset moves the dates. What is on screen is always what the chart is drawing.
 *
 * ## The date pickers
 *
 * A month grid in a sheet, rather than the platform picker. The app carries no
 * native picker and adding one would mean a new native module and a rebuild for two
 * fields; more to the point, the wheel picker's own idiom is a birthday, and this is
 * a reader tapping "the fourteenth" on a calendar they can see. Days past today are
 * unpickable — there is nothing measured there — and the two fields keep themselves
 * in order, so a "from" dragged past the "to" moves the "to" with it rather than
 * producing an empty chart.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { radius, shadowCard, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { dayKey } from '../../core/model/series';
import { dayNames, ta, type AppStringKey } from '../../core/i18n';

export interface DateRange {
  /** `YYYY-MM-DD`, local. */
  from: string;
  to: string;
}

/** Each preset is a whole-day window ending today. */
export const PRESETS = [
  { days: 1, labelKey: 'days1' },
  { days: 2, labelKey: 'days2' },
  { days: 7, labelKey: 'days7' },
  { days: 30, labelKey: 'days30' },
] as const;

export type PresetDays = (typeof PRESETS)[number]['days'];

const DAY_MS = 86_400_000;

/** The window a preset resolves to: `days` whole days, the last of them today. */
export function presetRange(days: number, now = new Date()): DateRange {
  const from = new Date(now.getTime() - (days - 1) * DAY_MS);
  return { from: dayKey(from), to: dayKey(now) };
}

/** What the page starts on. A single day is the cheapest useful request. */
export const DEFAULT_PRESET: PresetDays = 2;

export interface RangeSelectorProps {
  range: DateRange;
  /** Null once the reader has picked dates of their own. */
  preset: PresetDays | null;
  onPreset: (days: PresetDays) => void;
  onRange: (range: DateRange) => void;
}

export function RangeSelector({ range, preset, onPreset, onRange }: RangeSelectorProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);

  // Editing either end keeps the pair in order: dragging the start past the end
  // takes the end with it, rather than asking for a window that runs backwards.
  const pick = (day: string) => {
    if (editing === 'from') onRange({ from: day, to: day > range.to ? day : range.to });
    else if (editing === 'to') onRange({ from: day < range.from ? day : range.from, to: day });
    setEditing(null);
  };

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {PRESETS.map((p) => {
          const on = preset === p.days;
          return (
            <Pressable
              key={p.days}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onPreset(p.days);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                backgroundColor: on ? palette.accent : palette.surfaceAlt,
              }}
            >
              <Text variant="caption" weight="bold" color={on ? palette.appCard : palette.inkHeading}>
                {ta(p.labelKey as AppStringKey, prefs.lang)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <DateField
          label={ta('from', prefs.lang)}
          day={range.from}
          onPress={() => setEditing('from')}
        />
        <DateField
          label={ta('to', prefs.lang)}
          day={range.to}
          onPress={() => setEditing('to')}
        />
      </View>

      <DaySheet
        visible={editing !== null}
        day={editing === 'to' ? range.to : range.from}
        onPick={pick}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

/** One end of the window, as a button that opens the calendar. */
function DateField({ label, day, onPress }: { label: string; day: string; onPress: () => void }) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${longDate(day, prefs.lang)}`}
      style={{
        flex: 1, gap: 3,
        backgroundColor: palette.surfaceAlt,
        borderRadius: radius.tile,
        paddingVertical: 9,
        paddingHorizontal: space[4],
      }}
    >
      <Text
        variant="caption"
        weight="bold"
        color={palette.muted}
        style={{ letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 10 }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text variant="label" color={palette.inkHeading} numberOfLines={1} style={{ flexShrink: 1 }}>
          {shortDate(day, prefs.lang)}
        </Text>
        <Icon name="caret-right" size={11} color={palette.muted} />
      </View>
    </Pressable>
  );
}

/** "14 jun 2026" — the locale's own month name, in the app's language. */
function shortDate(day: string, lang: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return day;
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function longDate(day: string, lang: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return day;
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A month, as a grid of days.
 *
 * The month is stepped through UTC noon for the same reason `hourKeys` steps through
 * UTC: these are calendar dates, not instants, and letting the device's daylight
 * saving decide which day a cell is would put one day of the year in two cells.
 */
function DaySheet({
  visible, day, onPick, onClose,
}: {
  visible: boolean;
  day: string;
  onPick: (day: string) => void;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  /** Which month is on screen. */
  const [month, setMonth] = useState(day.slice(0, 7));

  // Opening the sheet lands on the month of the date being edited, not on wherever
  // the reader last paged to: the two fields are edited one after the other, and the
  // second would otherwise open in the first one's month.
  useEffect(() => {
    if (visible) setMonth(day.slice(0, 7));
  }, [visible, day]);

  const today = dayKey(new Date());
  const [year, mon] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year ?? 2026, (mon ?? 1) - 1, 1, 12));
  const daysInMonth = new Date(Date.UTC(year ?? 2026, mon ?? 1, 0, 12)).getUTCDate();
  // Monday first, as every Dutch calendar is: getUTCDay is 0 on Sunday.
  const lead = (first.getUTCDay() + 6) % 7;

  const step = (by: number) => {
    const next = new Date(Date.UTC(year ?? 2026, (mon ?? 1) - 1 + by, 1, 12));
    setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  // Two-letter weekday headings, from the app's own day names.
  const names = dayNames(prefs.lang);
  const headings = [1, 2, 3, 4, 5, 6, 0].map((i) => (names[i] ?? '').slice(0, 2));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={ta('done', prefs.lang)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}
      >
        {/* Swallows the press, so tapping the sheet does not dismiss it. */}
        <Pressable
          onPress={() => {}}
          style={[
            {
              backgroundColor: palette.appCard,
              borderTopLeftRadius: radius.appCard,
              borderTopRightRadius: radius.appCard,
              padding: space[5],
              paddingBottom: insets.bottom + space[5],
              gap: space[4],
            },
            shadowCard,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => step(-1)} accessibilityRole="button" hitSlop={12}>
              <Icon name="caret-left" size={17} color={palette.inkHeading} weight="bold" />
            </Pressable>
            <Text
              variant="label"
              color={palette.inkHeading}
              align="center"
              style={{ flex: 1 }}
            >
              {first.toLocaleDateString(prefs.lang, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </Text>
            <Pressable onPress={() => step(1)} accessibilityRole="button" hitSlop={12}>
              <Icon name="caret-right" size={17} color={palette.inkHeading} weight="bold" />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {headings.map((h, i) => (
              <Text
                key={i}
                variant="caption"
                color={palette.muted}
                align="center"
                style={{ flex: 1, fontSize: 11 }}
              >
                {h}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: lead }, (_, i) => (
              <View key={`lead${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const cell = `${month}-${String(i + 1).padStart(2, '0')}`;
              const on = cell === day;
              // There is nothing measured tomorrow.
              const ahead = cell > today;
              return (
                <Pressable
                  key={cell}
                  onPress={() => onPick(cell)}
                  disabled={ahead}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: ahead }}
                  style={{
                    width: `${100 / 7}%`, height: 40,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 34, height: 34, borderRadius: 17,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: on ? palette.accent : 'transparent',
                    }}
                  >
                    <Text
                      variant="bodySm"
                      weight={on ? 'bold' : 'regular'}
                      color={
                        on ? palette.appCard : ahead ? palette.inkDisabled : palette.inkHeading
                      }
                      tabular
                    >
                      {i + 1}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
