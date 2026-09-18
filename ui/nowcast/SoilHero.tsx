/**
 * The hero on a field's page.
 *
 * On a location a soil sensor speaks for, the weather hero is answering a question
 * nobody asked. It leads with a temperature that was modelled for the region, on a
 * page whose whole subject is one field — and the reading that decides what happens
 * today, the suction, is nowhere on it. So a field gets its own card.
 *
 * Modelled on the card the web app already shows for a sensor, because a grower who
 * uses both should not have to learn the same sensor twice. What differs is what this
 * app can honestly put on it: the serial number is not in API v2 and neither is the
 * soil type, so neither is invented here.
 *
 * ## The bar is the indicator, drawn
 *
 * Four zones from the field's own thresholds, and a marker where the reading sits.
 * That is the whole indicator layer in one object — a threshold, a state, a value —
 * and it is the clearest thing on the page precisely because the thresholds are the
 * field's own rather than a number this app chose. Every other indicator will be drawn
 * this way once it has boundaries worth drawing.
 *
 * A collapsed band — a field configured with no suboptimal stretch, which a fifth of
 * them are — takes no width, so it draws as nothing rather than as a sliver of a state
 * that field can never be in.
 *
 * ## Rainfall is not on this card
 *
 * It was, and it did not belong: this card is about the water *in* the ground, and the
 * rain that fell on it is weather. It sits on the weather card underneath, where the
 * reader is already looking for what the sky did — and on a PLUS or PRO it is that
 * sensor's own figure rather than the model's, which is the whole reason the merge
 * exists.
 *
 * ## One dot, and nothing on it that was not measured
 *
 * Everywhere else in the app the green dot goes per figure, because a block sits in a
 * grid where its neighbour may be modelled. Here there are no such neighbours: this
 * card shows what this sensor reported and nothing else, so one dot beside its name
 * says it once. A dot before every figure was four marks for one fact.
 *
 * That only works because the second half holds. **A quantity this sensor does not
 * measure is not on the card** — not as a dash, and certainly not as the model's
 * figure in an instrument's card. A BASIC has no rain gauge, so a BASIC's card has no
 * rainfall on it, and the reader is never left working out which of four numbers came
 * from where.
 */
import { View } from 'react-native';
import { Card } from '../Card';
import { Text } from '../Text';
import { Icon, type IconName } from '../Icon';
import { space, useTheme } from '../../theme';
import { usePrefs } from '../../state/prefs';
import { fmtDecimal, fmtTempValue, ta, tempUnitLabel } from '../../core/i18n';
import type { Indicator } from '../../core/model/indicators';
import { placementContext } from '../../core/model/soilTiles';
import type { Placement, SoilStatus } from '../../core/model/soil';
import { soilStatusInk } from '../soilStatusInk';
import { IndicatorBadge } from '../indicator/IndicatorBadge';
import type { SoilSample } from '../../core/sources/agroexact';

export interface SoilHeroProps {
  /** The field's name — the location's own, which is the sensor's name. */
  name: string;
  placement: Placement;
  latest: SoilSample;
  /** Suction as an indicator, for the bar and the binding threshold. Null where the
   *  field has no thresholds, in which case the bar is left off rather than guessed. */
  indicator: Indicator | null;
}

/** How far above the critical threshold the bar runs, so a field past it still has
 *  somewhere to sit rather than pinning to the very end. */
const BAR_HEADROOM = 1.15;

export function SoilHero({ name, placement, latest, indicator }: SoilHeroProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  // How much it would take to fill the root zone. Shown whenever the sensor reports
  // it, not only once the field is at "irrigate now": the card is a set of readings,
  // and withholding a measurement is different from withholding advice.
  const refill = latest.refillMm;

  return (
    <Card>
      <View style={{ gap: space[3] }}>
        {/* What it is and how fresh it is. The model badge earns its place: it says
            which probes are in the ground, and so which of the numbers below can
            exist at all. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          {/* One dot for the card: everything on it is this instrument's. */}
          <View
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.agroBright }}
          />
          <Text
            variant="bodySm"
            weight="semibold"
            color={palette.inkHeading}
            numberOfLines={1}
            style={{ flexShrink: 1, flexGrow: 1 }}
          >
            {name}
          </Text>
          {placement.sensorType ? (
            <View
              style={{
                borderWidth: 1, borderColor: palette.hairline,
                borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
              }}
            >
              <Text variant="caption" weight="semibold" color={palette.inkHeading}>
                {placement.sensorType}
              </Text>
            </View>
          ) : null}
          <Text variant="caption" color={palette.muted}>
            {ageLabel(latest.measTime, lang)}
          </Text>
        </View>

        {/* The readings, in the order the decision is made in: how dry, how much water
            is in there, how warm, and what fell on it. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
          <Reading
            icon="drop-half"
            value={latest.tension == null ? null : fmtDecimal(latest.tension)}
            unit="kPa"
          />
          <Reading
            icon="drop"
            value={latest.waterPercent == null ? null : fmtDecimal(latest.waterPercent)}
            unit="%"
          />
          <Reading
            icon="thermometer-simple"
            value={latest.soilTemp == null ? null : fmtTempValue(latest.soilTemp, prefs.tempUnit)}
            unit={tempUnitLabel(prefs.tempUnit)}
          />

        </View>

        {/* Provenance and the amount on one line. The first is not decoration — 48 kPa
            means one thing on sand under onions and another on heavy clay under
            potatoes — and the second is the only thing any indicator in this app can
            say about *how much*, so it belongs where the field is named rather than in
            a sentence of its own further down. */}
        <Text variant="caption" color={palette.muted}>
          {placementContext(placement, `${placement.depthCm} cm`)}
          {refill != null ? (
            <Text variant="caption" color={palette.muted}>
              {`  ·  ${ta('soilRefill', lang)} ${fmtDecimal(refill)} mm`}
            </Text>
          ) : null}
        </Text>

        {/* The verdict, and under it where that sits on the field's own ladder. The
            badge says what to do and the bar says how far from the next boundary you
            are; neither answers the other's question. */}
        {indicator?.now ? (
          <IndicatorBadge
            level={indicator.now.level}
            tone={soilStatusInk(indicator.now.level as SoilStatus, palette, appearance)}
            title={ta(STATUS_WORD[indicator.now.level] ?? 'soilStatus0', lang)}
            reason={bindingReason(indicator, lang)}
          />
        ) : null}

        {indicator ? <StateBar indicator={indicator} /> : null}
      </View>
    </Card>
  );
}

const STATUS_WORD = [
  'soilStatus0', 'soilStatus1', 'soilStatus2', 'soilStatus3',
] as const;

/**
 * Why the field is in the state it is, in one line.
 *
 * Read from the indicator rather than from the reading, which is the point of the
 * indicator existing: the boundary that binds, the value that crossed it, and the
 * amount where there is one. Nothing binds at level 0 — the field is simply fine —
 * and a sentence that said so would be the card explaining that nothing is wrong.
 */
function bindingReason(indicator: Indicator, lang: Parameters<typeof ta>[1]): string | undefined {
  const now = indicator.now;
  if (!now || now.value == null || !now.binding) return undefined;

  const parts = [
    `${fmtDecimal(now.value)} kPa`,
    `${ta('indicatorLimit', lang)} ${fmtDecimal(now.binding.at)}`,
  ];

  if (now.amount) {
    // One figure where the two ends are the same, which is every field today: the API
    // does not serve `water_until_nonschaarste`, so there is no lower end to name.
    const amount = now.amount.min === now.amount.max
      ? fmtDecimal(now.amount.max)
      : `${fmtDecimal(now.amount.min)} – ${fmtDecimal(now.amount.max)}`;
    parts.push(`${ta('soilRefill', lang)} ${amount} mm`);
  }

  return parts.join(' · ');
}

/**
 * One figure with its mark, its unit and an optional window under it.
 *
 * Nothing at all where there is no value. A dash would be the card saying this sensor
 * has a probe for this and it is silent, which on a BASIC is untrue and on a PRO is a
 * fault worth its own words rather than a quiet gap in a row of numbers.
 */
function Reading({
  icon, value, unit, sub,
}: { icon: IconName; value: string | null; unit: string; sub?: string }) {
  const { palette } = useTheme();
  if (value == null) return null;
  return (
    <View style={{ gap: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon name={icon} size={15} color={palette.muted} />
        <Text variant="bodySm" weight="semibold" color={palette.inkHeading} tabular>
          {value}
        </Text>
        <Text variant="caption" color={palette.muted}>
          {unit}
        </Text>
      </View>
      {sub ? (
        <Text variant="caption" color={palette.inkDisabled}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The field's four zones, with the reading's place in them.
 *
 * Widths come from the thresholds themselves, so the bar is a picture of this field
 * and not of a scale someone chose: a field whose critical sits at 40 kPa and one at
 * 200 both fill the same track, and the marker means the same thing on both.
 */
function StateBar({ indicator }: { indicator: Indicator }) {
  const { palette, appearance } = useTheme();
  const value = indicator.now?.value ?? null;

  const steps = [...indicator.thresholds].sort((a, b) => a.at - b.at);
  const critical = steps[steps.length - 1]?.at ?? 0;
  if (!critical) return null;

  const scale = Math.max(critical * BAR_HEADROOM, value ?? 0);

  // Each zone runs from the boundary that opens it to the next one, in fractions of
  // the track. The first runs from zero.
  const edges = [0, ...steps.map((t) => t.at), scale];
  const widths = edges.slice(1).map((edge, i) => Math.max(0, (edge - edges[i]!) / scale));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', height: 7, borderRadius: 4, overflow: 'hidden' }}>
        {widths.map((w, i) => (
          <View
            key={i}
            style={{ flex: w, backgroundColor: soilStatusInk(i as SoilStatus, palette, appearance) }}
          />
        ))}
      </View>
      {value != null ? (
        <View style={{ height: 2 }}>
          <View
            style={{
              position: 'absolute',
              left: `${Math.min(100, Math.max(0, (value / scale) * 100))}%`,
              width: 2, height: 9, marginTop: -13,
              backgroundColor: palette.inkHeading,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * How long ago the sensor last spoke, in the shape the web app's card uses.
 *
 * Relative rather than a clock time, because the question this line answers is "is
 * this current", and "14:20" makes the reader work out the answer themselves.
 */
function ageLabel(measTime: string, lang: Parameters<typeof ta>[1]): string {
  const ms = new Date(measTime).getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 90) return `${minutes} ${ta('soilAgeMin', lang)}`;
  return `${Math.round(minutes / 60)} ${ta('soilAgeHour', lang)}`;
}
