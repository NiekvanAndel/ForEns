/**
 * The map, full screen, with the nowcast profile beneath it.
 *
 * The radar card answers "where is it raining"; this answers "and how hard, here,
 * over the next two hours" — the map fills the screen so a shower's track is
 * readable, and the panel below turns the picture into the two numbers a reader
 * acts on.
 *
 * ## It is a page now, not a modal
 *
 * This used to be a modal the radar tab presented, and the map button in the top row
 * reached it by routing to that tab with a parameter that told it to open the modal.
 * Which made the map a thing the radar page owned, reachable from the top row by
 * going through a page the reader had not asked for — and left the button's
 * behaviour depending on which tab happened to be in front.
 *
 * So the relationship is the other way round: the map is `app/map.tsx`, the top row's
 * button pushes it, and the radar page's full-screen button pushes the same route.
 * Both arrive at the location that is already selected, because the selection is
 * shared state — the station the radar page was drawing is the station the map
 * opens on, with nothing passed between them to get out of step.
 *
 * The body lives here rather than in the route file so the route stays what every
 * other route in this app is: a page component and the frame around it.
 *
 * Every other saved location is a pin here, where there is room for them: tapping
 * one selects it, and the map, the profile and the pins all follow without leaving
 * the page. That is the only way to change location from here — the sideways swipe
 * that does it elsewhere belongs to the pages under the tab bar, and a map you can
 * pan is no place for a gesture that navigates.
 *
 * ## A second layer, and what it displaces
 *
 * The layer button in the top-right corner switches the map between the nowcast loop
 * and the cumulative rainfall totals. It is a choice, not an addition: two
 * precipitation ramps over the same ground leave neither of them meaning anything.
 *
 * So the panel below switches with it. The nowcast's curve and scrubber answer "how
 * hard, here, soon"; the totals' curve answers "how much, here, and how did it build
 * up". Both are the panel's one job — turn the picture into the number a reader acts
 * on — and neither is readable while the other's controls are on screen.
 *
 * The pins switch too. With the totals up every saved location carries its own figure
 * in a bubble instead of a dot, so the map answers for the reader's own places and not
 * only for the one the panel is about — see `CumulativeBubbles`, which also decides
 * which bubbles have room.
 *
 * Both layers fold the same way and through the same gesture, so a reader who put the
 * panel away keeps it away across a layer switch. Only the folded contents differ:
 * the radar loop's frames under one, the six windows under the other.
 *
 * ## The panel has two states, and each is one control
 *
 * Open, it is the curve with its header: the place, how hard it is raining at the
 * frame on screen, and a small play button beside the name. The curve is the
 * scrubber — dragging its handle moves the loop.
 *
 * Swiped down, all of that folds away and what is left is a single row: a full-sized
 * play button and the slider beside it. Sometimes the map is the whole point and the
 * panel should be a band across the bottom of it, and this is the smallest thing
 * that still drives the loop.
 *
 * The two trade places on one gesture — the row unfolds by exactly what the curve
 * gives up — so the panel keeps its height and the loop is scrubbable at both ends of
 * the drag. Nothing is shown twice: the header's play button and the row's are never
 * on screen together.
 *
 * Where there is no curve at all — a location the nowcast does not reach — there is
 * nothing to fold, so the grabber goes and the row simply stands. The rule under
 * every case is the same one: something on screen has to be draggable.
 *
 * ## A tap on the map puts the panel away entirely
 *
 * Folding makes the panel small; tapping the map makes it gone, and tapping again
 * brings it back. This is what Apple's weather map does, and the reason is the one
 * behind every other decision on this screen: the picture is the point, and there is
 * no arrangement of a panel that does not cover some of it. A gesture that gives the
 * reader the whole map for as long as they want it beats another few points shaved off
 * a control.
 *
 * It follows that the panel floats over the map rather than sitting under it, in both
 * orientations — there would be nothing to uncover otherwise. Sideways it also narrows
 * to a card in the middle, so what it covers is a strip rather than a band: height is
 * the scarce dimension there, and a panel that spends it across the full width is
 * spending it on white space either side of a 420-point control.
 */
import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { duration, radius, shadowFloat, space, useTheme } from '../../theme';
import { Icon } from '../Icon';
import { RadarMap, MAP_CHROME_SIZE, type PlacePin } from './RadarMap';
import { CumulativeLayer } from './CumulativeLayer';
import { CumulativeLegend } from './CumulativeLegend';
import { CumulativePanel } from './CumulativePanel';
import { CumulativeTimeline } from './CumulativeTimeline';
import { fieldVariableOf, MapLayersControl, type MapLayer } from './MapLayersControl';
import { FieldLayer } from '../fields/FieldLayer';
import { FieldBubbles } from '../fields/FieldBubbles';
import { FieldLegend } from '../fields/FieldLegend';
import { FieldPanel } from '../fields/FieldPanel';
import { useFields } from '../fields/useFields';
import { fixtureFieldSource } from '../fields/fixtureSource';
import { sampleField } from '../../core/fields';
import { CumulativeBubbles } from './CumulativeBubbles';
import { useCumulative } from './useCumulative';
import { useCumulativeReadings } from './useCumulativeReadings';
import { fixtureSource } from './fixtureSource';
import type { MapView } from '../../core/radar/bubbles';
import { Timeline } from './Timeline';
import { hasNowcastCurve, NowcastPanel } from './NowcastPanel';
import { FULL_MAP_START_ZOOM, LAYER_DEPTH, mapChrome } from './mapStyle';
import { useWeatherBeforeId } from './useMapStyle';
import { frameAtFraction } from './useRadarFrames';
import {
  forecastBoundary, frameClock, radarAxis, type NowcastProfile, type RadarFrame,
} from '../../core/radar';
import { useLandscape } from '../layout';
import { usePrefs } from '../../state/prefs';
import type { SavedLocation } from '../../core/prefs';
import { ta } from '../../core/i18n';

/** The header, the curve and its axis. Animating a fixed maximum is what lets the
 *  fold be a height rather than a measurement; set too high, the first part of it
 *  does nothing visible. */
const PROFILE_MAX_HEIGHT = 190;
/**
 * The folded row: a play button, three labels and the track under them.
 *
 * Measured rather than guessed, because a fold animates *to* this number and anything
 * short of the content is a row with its bottom cut off — which is what happened when
 * the nowcast row started showing its labels and this still said 50, the height of the
 * same row without them.
 *
 * 12.5pt caption ≈ 16, plus its 4pt gap, plus the scrubber's 40pt touch area = 60; plus
 * the block's own 8pt of air above = 68. The 42pt play button fits inside the 60, so it
 * is not what sets the height — which is exactly why the old number looked right.
 *
 * Both folded rows are this shape now, so they share it.
 */
const TIMELINE_HEIGHT = 68;
/** The same, for the totals panel: its heading, the figure, the window in clock terms
 *  and the curve with its axis. Taller than the nowcast profile because it carries the
 *  reading as well as the chart — and deliberately a little over rather than under, so
 *  a location with a long name is folded rather than clipped while it is open. */
const TOTALS_MAX_HEIGHT = 260;

/** How wide the floating panel gets in landscape. Wider than this and the play button
 *  and the far end of the track are a hand's width apart, which is a control nobody can
 *  work one-handed. */
const PANEL_MAX_WIDTH = 420;

/** Stable empty list, so the readings hook is not handed a new array every render
 *  while the cumulative layer is off. */
const EMPTY_LOCATIONS: SavedLocation[] = [];

/** What the panel shows for the selected location before any reading exists — which
 *  is the moment between switching the layer on and the manifest arriving. */
const SELECTED_PENDING = {
  mm: null, origin: null, outsideCrop: false, loading: true,
} as const;

export interface FullMapProps {
  /** Leaves the page. The route hands in `router.back()`. */
  onClose: () => void;
  lat: number;
  lon: number;
  frames: RadarFrame[];
  activeIndex: number;
  onScrub: (index: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** The reader's other saved locations, as pins that switch to them. */
  places: PlacePin[];
  onSelectPlace: (index: number) => void;
  profile: NowcastProfile | null;
  /** Named in the profile's header, as on the radar page. */
  locationName?: string;
  /**
   * The location itself, for the cumulative read-out.
   *
   * `lat`/`lon` place the camera, but a rainfall total also has to know whether a rain
   * gauge is standing here: on a station-backed location the station's own measurement
   * is the answer, and the radar field is only an estimate of it.
   */
  location: SavedLocation;
}

export function FullMap({
  onClose, lat, lon, frames, activeIndex, onScrub,
  playing, onTogglePlay, places, onSelectPlace, profile, locationName, location,
}: FullMapProps) {
  const { palette, appearance } = useTheme();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Sideways the panel narrows to a card at the bottom centre rather than spanning the
  // width, and the map keeps the whole screen behind it. See the note at the top.
  const landscape = useLandscape();
  const chrome = mapChrome(palette, appearance);
  const [panelWidth, setPanelWidth] = useState(width);
  // The profile collapses out of the way; the timeline below it never does.
  const [profileOpen, setProfileOpen] = useState(true);
  // And the whole panel goes, on a tap on the map. Kept as React state as well as a
  // shared value because `pointerEvents` is a prop, not a style: a panel faded to
  // nothing still swallows the tap meant to bring it back.
  const [panelHidden, setPanelHidden] = useState(false);
  const reduceMotion = useReducedMotion();
  const collapse = useSharedValue(0);
  const hide = useSharedValue(0);
  // Nothing to fold away, and nothing to drag: the slider stands rather than
  // trading places with a curve that was never drawn.
  const curve = hasNowcastCurve(profile);

  // The second layer. Nothing is fetched until it is chosen, so a reader who never
  // opens the picker pays nothing for it.
  const [layer, setLayer] = useState<MapLayer>('nowcast');
  const [layersOpen, setLayersOpen] = useState(false);
  // Where the map is, for deciding which bubbles would land on top of each other.
  // Only tracked while the bubbles are up: a state update per frame of a pan is not
  // something to do for a layer nobody has switched on.
  const [view, setView] = useState<MapView | null>(null);
  const cumulative = useCumulative(fixtureSource);
  const totals = layer === 'cumulative';
  // The three Detailcharts layers are one thing to this screen: a scalar field on a
  // loop. Only the variable differs, so they share a hook, a panel and a legend.
  const fields = useFields(fixtureFieldSource);
  // A field sits deeper in the basemap than rain does — under the water as well — so
  // the two overlays this screen owns take their own depths. See `LAYER_DEPTH`.
  const fieldBeforeId = useWeatherBeforeId(LAYER_DEPTH.field);
  const rainBeforeId = useWeatherBeforeId(LAYER_DEPTH.cumulative);
  const fieldVariable = fieldVariableOf(layer);
  const showField = fieldVariable != null;

  // The reader's own list, which is both what carries a bubble each and the order
  // that settles an overlap.
  const locations = prefs.locations;
  // -1 where the selected location is not in the list at all, which happens only with
  // an empty list and the built-in default standing in for it. Left as -1 rather than
  // clamped to 0: clamping would fill in the first location's bubble as if it were the
  // one the map is about.
  const selectedIndex = locations.indexOf(location);
  const { readings, series } = useCumulativeReadings(
    totals ? locations : EMPTY_LOCATIONS,
    location,
    cumulative.manifest,
    cumulative.windows,
    cumulative.window,
    cumulative.rasters
  );
  const reading = readings[selectedIndex] ?? SELECTED_PENDING;

  // The field's value at each saved location for the frame on screen. Recomputed per
  // frame, which is a handful of array lookups: the expensive part is the raster, and
  // that is fetched once per frame by the hook.
  const fieldValues = useMemo(
    () =>
      fields.manifest && fields.values
        ? locations.map((l) => sampleField(fields.manifest!, fields.values!, l.lat, l.lon))
        : locations.map(() => null),
    [fields.manifest, fields.values, locations]
  );
  // Only a panel with a curve in it has anything to fold. While the totals are still
  // loading — or cannot be built at all — the panel is a single line of explanation,
  // and a grabber over it would promise a drag that does nothing.
  // A field layer has no curve to fold: its panel is one reading and the slider under
  // it, which is the arrangement `FullMap` already uses where the nowcast has nothing
  // to draw. Nothing to fold means no grabber, and the row simply stands.
  const foldable = showField
    ? false
    : totals
      ? cumulative.status === 'ready' && !!cumulative.window
      : curve;

  // Under the back button, level with the layers card across the map.
  const legendTop = insets.top + space[2] + MAP_CHROME_SIZE + space[2];
  const legendLeft = insets.left + 14;

  const chooseLayer = (next: MapLayer) => {
    setLayer(next);
    cumulative.setEnabled(next === 'cumulative');
    // Null takes the field layer off entirely, so a reader who never picks one pays
    // for no manifest and no rasters.
    fields.setVariable(fieldVariableOf(next));
    // A loop nobody can see should not be running. Its frames come off the map with
    // the layer switch, and a reader coming back to find the play head somewhere else
    // has watched time pass behind a picture that was not on screen.
    if (next !== 'nowcast' && playing) onTogglePlay();
  };

  const togglePanel = () => {
    const next = !panelHidden;
    setPanelHidden(next);
    hide.value = reduceMotion
      ? (next ? 1 : 0)
      : withTiming(next ? 1 : 0, { duration: duration.base });
  };

  const setOpen = (open: boolean) => {
    setProfileOpen(open);
    collapse.value = reduceMotion
      ? (open ? 0 : 1)
      : withTiming(open ? 0 : 1, { duration: duration.base });
  };

  // A downward drag on the profile puts it away; an upward one brings it back.
  const drag = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .onEnd((e) => {
      if (e.translationY > 30 || e.velocityY > 500) runOnJS(setOpen)(false);
      else if (e.translationY < -30 || e.velocityY < -500) runOnJS(setOpen)(true);
    });

  // Sliding down as it fades, so it reads as the panel leaving rather than the panel
  // dissolving. A fixed distance: the panel's height is not known here, and past the
  // first few points of travel a fade has already done the work.
  const panelStyle = useAnimatedStyle(() => ({
    opacity: 1 - hide.value,
    transform: [{ translateY: hide.value * 36 }],
  }));

  const profileStyle = useAnimatedStyle(() => ({
    opacity: 1 - collapse.value,
    // Collapsing height rather than translating keeps everything below it in place.
    maxHeight: (1 - collapse.value) * PROFILE_MAX_HEIGHT,
  }));

  // The exact inverse: what the curve gives up, the slider takes.
  const timelineStyle = useAnimatedStyle(() => ({
    opacity: collapse.value,
    maxHeight: collapse.value * TIMELINE_HEIGHT,
  }));

  // The panels themselves are different heights, so they keep separate styles: a fold
  // that animates the wrong one either clips the panel open or spends its first inches
  // on nothing. Their folded rows are the same shape, though, so those share `timelineStyle`.
  const totalsStyle = useAnimatedStyle(() => ({
    opacity: 1 - collapse.value,
    maxHeight: (1 - collapse.value) * TOTALS_MAX_HEIGHT,
  }));

  const active = frames[activeIndex];
  // Minutes from now for the frame on screen, which is what the panel's cursor and
  // its headline intensity are pinned to.
  const offsetMin = active ? Math.round((active.timeMs - Date.now()) / 60_000) : 0;
  // One axis for the chart and the scrubber, exactly as on the radar page.
  const axis = radarAxis(frames);

  const scrubTo = (fraction: number) => {
    const at = frameAtFraction(axis?.positions, fraction);
    if (at != null) onScrub(at);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.appBg }}>
      <View style={{ flex: 1 }}>
        <RadarMap
          lat={lat}
          lon={lon}
          startZoom={FULL_MAP_START_ZOOM}
          frames={frames}
          activeIndex={activeIndex}
          places={places}
          onSelectPlace={onSelectPlace}
          showFrames={!totals && !showField}
          showPins={!totals && !showField}
          onViewChange={totals || showField ? setView : undefined}
          onMapPress={togglePanel}
          overlay={
            showField && fields.manifest && fieldVariable ? (
              <>
                <FieldLayer
                  manifest={fields.manifest}
                  frames={fields.frames}
                  active={fields.frame}
                  source={fixtureFieldSource}
                  beforeId={fieldBeforeId}
                />
                <FieldBubbles
                  variable={fieldVariable}
                  legend={fields.manifest.legend}
                  locations={locations}
                  values={fieldValues}
                  unit={fields.manifest.unit}
                  selectedIndex={selectedIndex}
                  view={view}
                  onSelect={onSelectPlace}
                />
              </>
            ) : totals && cumulative.manifest ? (
              <>
                <CumulativeLayer
                  manifest={cumulative.manifest}
                  windows={cumulative.windows}
                  active={cumulative.window}
                  source={fixtureSource}
                  beforeId={rainBeforeId}
                />
                <CumulativeBubbles
                  locations={locations}
                  readings={readings}
                  selectedIndex={selectedIndex}
                  view={view}
                  onSelect={onSelectPlace}
                />
              </>
            ) : null
          }
          showControls={false}
          // The map runs under the status bar here, so its chrome starts below
          // the safe area: the time badge used to sit behind the battery.
          chromeTop={insets.top + space[2]}
          // The panel below is pulled up over the map by one card radius, so the
          // attribution has to clear that much or it is hidden behind it.
          attributionPosition={{ bottom: radius.appCard + space[2], left: space[3] }}
          style={{ flex: 1, borderRadius: 0 }}
        />

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={ta('done', prefs.lang)}
          hitSlop={10}
          style={[
            {
              // Same line as the time badge on the right, and the same height,
              // so the two read as one row of chrome across the top.
              position: 'absolute', left: insets.left + 14, top: insets.top + space[2],
              width: MAP_CHROME_SIZE, height: MAP_CHROME_SIZE, borderRadius: radius.pill,
              backgroundColor: chrome.bg,
              alignItems: 'center', justifyContent: 'center',
            },
            shadowFloat,
          ]}
        >
          <Icon name="caret-left" size={18} color={chrome.ink} weight="bold" />
        </Pressable>

        {/* The top-right corner, level with the back button opposite. It used to sit a
            row below a time badge; the time lives in the panel now, so this moves up
            into the space that left. */}
        <MapLayersControl
          active={layer}
          onSelect={chooseLayer}
          open={layersOpen}
          onOpenChange={setLayersOpen}
          top={insets.top + space[2]}
          right={insets.right + 14}
        />

        {/* Both legends stand in the top-left corner, under the back button and on the
            same line the layers control starts on opposite them. Only one can be up:
            the picker is a radio. */}
        {totals && cumulative.manifest ? (
          <CumulativeLegend legend={cumulative.manifest.legend} top={legendTop} left={legendLeft} />
        ) : null}

        {showField && fields.manifest ? (
          <FieldLegend
            legend={fields.manifest.legend}
            unit={fields.manifest.unit}
            top={legendTop}
            left={legendLeft}
          />
        ) : null}
      </View>

      {/* Over the map rather than under it, so a tap on the map has something to
          uncover — and, sideways, so the map keeps the height a band would take.
          `box-none` lets a tap through the padding around the card to the map below;
          `none` while hidden lets the tap that brings it back reach the map at all. */}
      <Animated.View
        pointerEvents={panelHidden ? 'none' : 'box-none'}
        style={[
          {
            position: 'absolute', left: 0, right: 0, bottom: 0,
            alignItems: landscape ? 'center' : 'stretch',
          },
          landscape ? { paddingBottom: insets.bottom + space[3] } : null,
          panelStyle,
        ]}
      >
      <View
        onLayout={(e) => setPanelWidth(e.nativeEvent.layout.width)}
        style={[
          { backgroundColor: palette.appCard },
          landscape
            ? {
                // Capped, because a control that spans a landscape screen puts its play
                // button and the end of its track a hand's width apart. Centred on the
                // screen: this page is pushed over the tab bar, not beside it, so there
                // is nothing standing against the right edge to lean away from.
                width: Math.min(
                  PANEL_MAX_WIDTH,
                  width - insets.left - insets.right - space[6]
                ),
                borderRadius: radius.appCard,
                paddingBottom: space[3],
                ...shadowFloat,
              }
            : {
                borderTopLeftRadius: radius.appCard,
                borderTopRightRadius: radius.appCard,
                paddingBottom: insets.bottom + space[3],
                ...shadowFloat,
              },
        ]}
      >
        <GestureDetector gesture={drag}>
          <View>
            {/* The grabber says the panel moves, and taps as a shortcut for the
                reader who would rather not drag. With nothing to fold — a location
                the nowcast cannot reach, or totals that have not loaded — it is not
                drawn, because it would promise a drag that does nothing. */}
            {foldable ? (
              <Pressable
                onPress={() => setOpen(!profileOpen)}
                accessibilityRole="button"
                accessibilityLabel={`${totals ? 'Neerslagsom' : 'Neerslaggrafiek'} ${profileOpen ? 'verbergen' : 'tonen'}`}
                accessibilityState={{ expanded: profileOpen }}
                hitSlop={10}
                style={{ alignItems: 'center', paddingTop: space[3], paddingBottom: space[2] }}
              >
                <View
                  style={{
                    width: 38, height: 4, borderRadius: 2,
                    backgroundColor: palette.hairline,
                  }}
                />
              </Pressable>
            ) : null}

            {showField ? (
              <FieldPanel
                status={fields.status}
                manifest={fields.manifest}
                frames={fields.frames}
                index={fields.index}
                onIndexChange={fields.setIndex}
                playing={fields.playing}
                onTogglePlay={fields.togglePlay}
                retryAfterSec={fields.retryAfterSec}
              />
            ) : totals ? (
              <Animated.View
                style={[{ overflow: 'hidden' }, foldable ? totalsStyle : undefined]}
              >
                {/* Its own air above it only where the grabber is not drawing any. */}
                <View style={{ paddingTop: foldable ? 0 : space[4] }}>
                  <CumulativePanel
                    status={cumulative.status}
                    manifest={cumulative.manifest}
                    windows={cumulative.windows}
                    index={cumulative.index}
                    onIndexChange={cumulative.setIndex}
                    playing={cumulative.playing}
                    onTogglePlay={cumulative.togglePlay}
                    reading={reading}
                    series={series}
                    locationName={locationName}
                    retryAfterSec={cumulative.retryAfterSec}
                    width={Math.max(1, panelWidth - space[5] * 2)}
                  />
                </View>
              </Animated.View>
            ) : (
              <Animated.View style={[{ overflow: 'hidden' }, profileStyle]}>
                <NowcastPanel
                  profile={profile}
                  offsetMin={offsetMin}
                  width={Math.max(1, panelWidth - space[5] * 2)}
                  domain={axis ? { from: axis.from, to: axis.to } : undefined}
                  locationName={locationName}
                  onScrubFraction={scrubTo}
                  boundaryFraction={forecastBoundary(frames, axis?.positions)}
                  timeLabel={frameClock(active)}
                  playing={playing}
                  onTogglePlay={onTogglePlay}
                  playDisabled={frames.length < 2}
                />
              </Animated.View>
            )}
          </View>
        </GestureDetector>

        {/* A field layer carries its own slider inside the panel, so there is no
            second row to stand in for a folded curve. */}
        {showField ? null : totals ? (
          foldable ? (
            <Animated.View
              // Invisible is also untouchable: a slider at zero opacity behind the
              // curve would still swallow the drag meant for the curve.
              pointerEvents={profileOpen ? 'none' : 'auto'}
              style={[
                { overflow: 'hidden', paddingHorizontal: space[5], paddingTop: space[2] },
                timelineStyle,
              ]}
            >
              <CumulativeTimeline
                windows={cumulative.windows}
                index={cumulative.index}
                onIndexChange={cumulative.setIndex}
                playing={cumulative.playing}
                onTogglePlay={cumulative.togglePlay}
              />
            </Animated.View>
          ) : null
        ) : curve ? (
          <Animated.View
            // Invisible is also untouchable: a slider at zero opacity behind the
            // curve would still swallow the drag meant for the curve.
            pointerEvents={profileOpen ? 'none' : 'auto'}
            style={[
              { overflow: 'hidden', paddingHorizontal: space[5], paddingTop: space[2] },
              timelineStyle,
            ]}
          >
            <Timeline
              frames={frames}
              index={activeIndex}
              onIndexChange={onScrub}
              playing={playing}
              onTogglePlay={onTogglePlay}
              stepPositions={axis?.positions}
            />
          </Animated.View>
        ) : (
          <View style={{ paddingHorizontal: space[5], paddingTop: space[2] }}>
            <Timeline
              frames={frames}
              index={activeIndex}
              onIndexChange={onScrub}
              playing={playing}
              onTogglePlay={onTogglePlay}
              stepPositions={axis?.positions}
            />
          </View>
        )}
      </View>
      </Animated.View>
    </View>
  );
}
