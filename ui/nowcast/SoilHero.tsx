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
import type { Placement } from '../../core/model/soil';
import type { SoilSample } from '../../core/sources/agroexact';

export interface SoilHeroProps {
  /** The field's name — the location's own, which is the sensor's name. */
  name: string;
  placement: Placement;
  latest: SoilSample;
  /** Suction as an indicator, for the bar and the binding threshold. Null where the
   *  field has no thresholds, in which case the bar is left off rather than guessed. */
  indicator: Indicator | null;
  /** Rain over the last 24 hours, from the model this sensor's own hours were merged
   *  into. Rain and irrigation are one number, by decision. */
  rain24: number | null;
  /** Whether that rainfall is this sensor's own. False on a BASIC, which has no
   *  gauge, and then the figure is the model's. */
  rainMeasured: boolean;
}

/** How far above the critical threshold the bar runs, so a field past it still has
 *  somewhere to sit rather than pinning to the very end. */
const BAR_HEADROOM = 1.15;

export function SoilHero({
  name, placement, latest, indicator, rain24, rainMeasured,
}: SoilHeroProps) {
  const { palette } = useTheme();
  const { prefs } = usePrefs();
  const lang = prefs.lang;

  const amount = indicator?.now?.amount ?? null;

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
          {/* Only where this sensor has a gauge. On a BASIC the figure would be the
              model's, and a modelled number inside an instrument's card is exactly
              the claim this app must not make. */}
          <Reading
            icon="cloud-rain"
            value={rainMeasured && rain24 != null ? fmtDecimal(rain24) : null}
            unit="mm"
            sub={ta('last24h', lang)}
          />
        </View>

        {/* Provenance, not decoration: 48 kPa means one thing on sand under onions and
            another on heavy clay under potatoes. */}
        <Text variant="caption" color={palette.muted}>
          {placementContext(placement, `${placement.depthCm} cm`)}
        </Text>

        {amount ? (
          <Text variant="bodySm" color={palette.muted}>
            {`${ta('soilRefill', lang)}: ${fmtDecimal(amount.min)} – ${fmtDecimal(amount.max)} mm`}
            <Text variant="caption" color={palette.inkDisabled}>
              {`  (${ta('soilToDepth', lang)})`}
            </Text>
          </Text>
        ) : null}

        {indicator ? <StateBar indicator={indicator} /> : null}
      </View>
    </Card>
  );
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
  const { palette } = useTheme();
  const value = indicator.now?.value ?? null;

  const steps = [...indicator.thresholds].sort((a, b) => a.at - b.at);
  const critical = steps[steps.length - 1]?.at ?? 0;
  if (!critical) return null;

  const scale = Math.max(critical * BAR_HEADROOM, value ?? 0);
  const ink = [palette.agroInk, palette.valSun, palette.valTemp, palette.valHigh];

  // Each zone runs from the boundary that opens it to the next one, in fractions of
  // the track. The first runs from zero.
  const edges = [0, ...steps.map((t) => t.at), scale];
  const widths = edges.slice(1).map((edge, i) => Math.max(0, (edge - edges[i]!) / scale));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', height: 7, borderRadius: 4, overflow: 'hidden' }}>
        {widths.map((w, i) => (
          <View key={i} style={{ flex: w, backgroundColor: ink[i] ?? palette.valHigh }} />
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
