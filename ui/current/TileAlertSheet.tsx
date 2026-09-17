/**
 * Setting an alert on one block: the form, as the second face of `TileSheet`.
 *
 * The shape is the web app's, because people already know it: the quantity and its
 * window at the top, a rule and a value, then the stations to watch. What comes out
 * is a `UserAlert`, and the list of them lives in Instellingen → Meldingen.
 *
 * ## Why it opens from the block rather than from Instellingen
 *
 * Because the block is where somebody is standing when the thought occurs. "Sixteen
 * degrees — tell me when it drops below two" is one gesture from the number that
 * prompted it, and three screens from a settings page. The list still lives in
 * Instellingen, where a list belongs; this is only where one is made.
 *
 * ## A face, not a second sheet
 *
 * It was a `Modal` of its own at first, opened as the comparison sheet closed. On iOS
 * a modal presented in the same frame as another is dismissed does not reliably
 * survive it, and the fix — waiting for `onDismiss`, with a timer in case it never
 * comes — is a lot of machinery for a form. The comparison sheet swaps its body
 * instead: one modal, one header that stays put, and the two faces are what they look
 * like, which is two views of the same block.
 *
 * ## Units
 *
 * The value is typed and shown in the reader's own units and stored in the app's —
 * type 36 in Fahrenheit and the rule holds 2.2 °C. That is what keeps a rule meaning
 * the same thing after somebody switches units, and what lets a server evaluate it
 * without knowing what the phone was set to. See `core/alerts`.
 *
 * ## Stations, not locations
 *
 * A saved location can be anywhere; a threshold on a measurement needs something that
 * measures. So the list is the AgroExact stations on the account, and without an
 * account there is nothing to offer — which the sheet says rather than showing an
 * empty list and leaving the reason to be guessed.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../Text';
import { Icon } from '../Icon';
import { usePrefs } from '../../state/prefs';
import { useAgroStations } from '../../state/stations';
import {
  draftProblem, makeAlert, upsertAlert,
  type AlertKind, type AlertOp, type DraftAlert,
} from '../../core/alerts';
import type { Tile } from '../../core/model/tiles';
import {
  convTempExact, convWindExact, t, ta, tempUnitLabel, windUnitLabel,
} from '../../core/i18n';
import type { Prefs } from '../../core/prefs';

export interface TileAlertFormProps {
  /**
   * The block the rule is about — and it has to be one a rule can be made on.
   *
   * A rule watches weather stations, so the soil blocks have nothing to be evaluated
   * against yet. Requiring the narrower kind here means the sheet cannot offer a rule
   * that would save and never fire; see `AlertKind`.
   */
  tile: Tile & { kind: AlertKind };
  /** Saved, or backed out of — both return to the comparison face. */
  onDone: () => void;
}

/**
 * The unit a threshold is typed in, and the two conversions between it and storage.
 *
 * One place, so the label above the field and the number that gets stored cannot
 * disagree — which is the way a units bug survives review: the field says °F and the
 * rule quietly holds 36.
 */
function unitFor(kind: AlertKind, prefs: Prefs): {
  label: string;
  toCanonical: (v: number) => number;
  fromCanonical: (v: number) => number;
} {
  switch (kind) {
    case 'temp':
      return {
        label: tempUnitLabel(prefs.tempUnit),
        // Back through the same formulas the conversion uses, rather than a second
        // set written out: an inverse derived by hand is an inverse that drifts.
        toCanonical: (v) =>
          prefs.tempUnit === 'F' ? ((v - 32) * 5) / 9 : prefs.tempUnit === 'K' ? v - 273.15 : v,
        fromCanonical: (v) => convTempExact(v, prefs.tempUnit) ?? v,
      };
    case 'wind':
      return {
        label: windUnitLabel(prefs.windUnit, prefs.lang),
        toCanonical: (v) =>
          prefs.windUnit === 'ms' ? v * 3.6
            : prefs.windUnit === 'kn' ? v / 0.54
              // Beaufort is a force, not a speed. Its lower bound in km/h is the
              // honest reading of "more than 6 Bft": the wind that first counts as 6.
              : prefs.windUnit === 'bft' ? beaufortFloor(v)
                : v,
        fromCanonical: (v) => convWindExact(v, prefs.windUnit) ?? v,
      };
    case 'mm':
      return { label: 'mm', toCanonical: (v) => v, fromCanonical: (v) => v };
    case 'percent':
      return { label: '%', toCanonical: (v) => v, fromCanonical: (v) => v };
    case 'direction':
      return { label: '°', toCanonical: (v) => v, fromCanonical: (v) => v };
  }
}

/** The slowest wind that still counts as this force, km/h — the Beaufort table's
 *  own lower bounds. */
function beaufortFloor(bft: number): number {
  const floors = [0, 1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  const i = Math.max(0, Math.min(floors.length - 1, Math.round(bft)));
  return floors[i] as number;
}

export function TileAlertForm({ tile, onDone }: TileAlertFormProps) {
  const { palette } = useTheme();
  const { prefs, setPref } = usePrefs();
  const stations = useAgroStations();

  const [op, setOp] = useState<AlertOp>('above');
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const unit = useMemo(() => unitFor(tile.kind, prefs), [tile.kind, prefs]);

  // A comma is what a Dutch keyboard offers and what every number in this app is
  // printed with, so it has to be accepted as one.
  const typed = Number(text.replace(',', '.'));
  const value = text.trim() && Number.isFinite(typed) ? unit.toCanonical(typed) : null;

  const rows = stations.data ?? [];
  const draft: DraftAlert = {
    tileId: tile.id,
    title: tile.title,
    timeLabel: tile.timeLabel,
    kind: tile.kind,
    op,
    value,
    stationIds: picked,
    stationNames: picked.map((id) => rows.find((r) => r.id === id)?.name ?? id),
  };
  const problem = draftProblem(draft);

  const save = () => {
    setTouched(true);
    const alert = makeAlert(draft);
    if (!alert) return;
    Haptics.selectionAsync().catch(() => {});
    setPref('userAlerts', upsertAlert(prefs.userAlerts, alert));
    onDone();
  };

  const toggleStation = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[5], gap: space[5] }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Rule and value on one line, because they are one sentence: "more than 25".
          Split across two rows they read as two questions. */}
      <View style={{ flexDirection: 'row', gap: space[4], alignItems: 'flex-end' }}>
        <View style={{ flex: 1, gap: space[2] }}>
          <Text variant="eyebrow" color={palette.muted}>
            {ta('alertRule', prefs.lang)}
          </Text>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <OpButton
              label={ta('alertAbove', prefs.lang)}
              on={op === 'above'}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setOp('above'); }}
            />
            <OpButton
              label={ta('alertBelow', prefs.lang)}
              on={op === 'below'}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setOp('below'); }}
            />
          </View>
        </View>

        <View style={{ width: 118, gap: space[2] }}>
          <Text variant="eyebrow" color={palette.muted}>
            {ta('alertValue', prefs.lang)}
          </Text>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              borderBottomWidth: 1,
              borderBottomColor:
                touched && problem === 'value' ? palette.valHigh : palette.hairline,
              paddingBottom: 6,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              // Decimals and a minus: a frost rule is below zero, and a rainfall one
              // is a tenth of a millimetre.
              keyboardType="numbers-and-punctuation"
              placeholder="—"
              placeholderTextColor={palette.inkDisabled}
              style={{
                flex: 1, fontSize: 20, fontFamily: 'Figtree_700Bold',
                color: palette.inkHeading, padding: 0,
              }}
            />
            <Text variant="caption" weight="semibold" color={palette.muted}>
              {unit.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ gap: space[3] }}>
        <Text variant="bodySm" color={palette.ink}>
          {rows.length ? ta('alertStations', prefs.lang) : ta('alertNoStations', prefs.lang)}
        </Text>

        {rows.map((station) => {
          const on = picked.includes(station.id);
          return (
            <Pressable
              key={station.id}
              onPress={() => toggleStation(station.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 8,
              }}
            >
              <View
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  borderWidth: on ? 0 : 1.5,
                  borderColor: palette.hairline,
                  backgroundColor: on ? palette.accent : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {on ? <Icon name="check" size={14} color="#fff" weight="bold" /> : null}
              </View>
              <Text
                variant="label"
                color={on ? palette.inkHeading : palette.muted}
                numberOfLines={1}
                style={{ flexShrink: 1 }}
              >
                {station.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Only after a save was attempted, and naming the one thing missing — a
          disabled button with no reason is how a form strands somebody. */}
      {touched && problem ? (
        <Text variant="caption" color={palette.valHigh}>
          {problem === 'value'
            ? ta('alertNeedValue', prefs.lang)
            : ta('alertNeedStations', prefs.lang)}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space[3], marginBottom: space[6] }}>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          style={{
            paddingVertical: 14, paddingHorizontal: space[5],
            borderRadius: radius.pill,
            borderWidth: 1, borderColor: palette.hairline,
            alignItems: 'center',
          }}
        >
          <Text variant="label" weight="semibold" color={palette.muted}>
            {t('cancel', prefs.lang)}
          </Text>
        </Pressable>

        <Pressable
          onPress={save}
          accessibilityRole="button"
          style={{
            flex: 1,
            backgroundColor: palette.accent,
            borderRadius: radius.pill,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: problem ? 0.55 : 1,
          }}
        >
          <Text variant="label" weight="bold" color="#fff">
            {ta('alertSave', prefs.lang)}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** One half of the rule choice. Two buttons rather than a picker: there are two
 *  answers, and a wheel to reach one of two is a wheel too many. */
function OpButton({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: radius.pill,
        alignItems: 'center',
        backgroundColor: on ? palette.accentTint : 'transparent',
        borderWidth: on ? 0 : 1,
        borderColor: palette.hairline,
      }}
    >
      <Text variant="label" weight={on ? 'bold' : 'medium'} color={on ? palette.accentDark : palette.muted}>
        {label}
      </Text>
    </Pressable>
  );
}
