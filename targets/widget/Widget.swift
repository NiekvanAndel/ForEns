import WidgetKit
import SwiftUI

/// ExactCast widgets: home screen small, medium and large, plus the lock-screen
/// accessories.
///
/// The design system's rules apply here as they do in the app: blue is weather,
/// green names an AgroExact station and nothing else, and reading colours follow
/// the quantity — high is warm red, low is cool blue.
///
/// Every value arrives pre-formatted from `core/widget.ts`; this file lays out
/// text and never computes weather. The one exception is `glyphLayers`, which reads
/// a symbol's layers from its name so the glyphs match the app's colours exactly.

// MARK: - Weather glyph

/// The colour of each layer of a weather glyph, read from the symbol's own name.
///
/// A port of `glyphLayerColors` in `core/model/conditions.ts`, and it has to stay
/// one: the app and the widget sit side by side on the same home screen, and a
/// shower drawn in two different blues there is the kind of thing nobody can
/// unsee. Apple names these symbols compositionally — `cloud.sun.rain.fill` is
/// exactly cloud, then sun, then rain — so both sides read the layers the same way.
///
/// The widget used to hand every glyph to `.multicolor`, which draws clouds white
/// and the moon pale blue. Those were never the app's colours.
private func glyphLayers(_ symbol: String) -> [Color] {
    var colors: [Color] = []
    // A moon beside a cloud keeps the sun's light: pale on pale would merge the two
    // layers into one shape. Alone — `moon.fill`, and the disc of `moon.stars.fill`
    // — it is drawn in the moon's own tone, and the stars carry the warmth.
    let moon = symbol.contains("cloud") ? Color("WidgetGlyphSun") : Color("WidgetGlyphMoon")
    for part in symbol.split(separator: ".") {
        switch part {
        // Fog is drawn as lines under the cloud and reads as part of it.
        case "cloud", "fog":
            colors.append(Color("WidgetGlyphCloud"))
        case "sun", "stars":
            colors.append(Color("WidgetGlyphSun"))
        case "moon":
            colors.append(moon)
        case "rain", "heavyrain", "drizzle", "sleet":
            colors.append(Color("WidgetGlyphPrecip"))
        // Snow takes the cloud's tone deliberately: white flakes on a grey cloud
        // read as two objects, and the flakes are the smallest marks in the set.
        case "snow", "snowflake":
            colors.append(Color("WidgetGlyphCloud"))
        case "bolt", "hail":
            colors.append(Color("WidgetGlyphStorm"))
        // `fill` and `max` are qualifiers, not layers.
        default:
            break
        }
    }
    return colors
}

/// A weather symbol in the app's own colours.
///
/// `foregroundStyle` has no variadic form, so three styles are always passed and a
/// short list repeats its last colour. SwiftUI ignores styles past the symbol's own
/// layer count, and a symbol with more layers than the name reveals then takes that
/// last colour rather than the system's default tint — which is blue, and which is
/// how a moon came to be blue in the first place.
///
/// One expression, no branches: a result builder is a poor place to discover a
/// compile error, and this file cannot be built from the environment it is written
/// in.
struct WeatherGlyph: View {
    let symbol: String
    let size: CGFloat

    var body: some View {
        let layers = glyphLayers(symbol)
        let first = layers.first ?? Color("WidgetGlyphCloud")
        let second = layers.count > 1 ? layers[1] : first
        let third = layers.count > 2 ? layers[2] : second

        Image(systemName: symbol)
            .symbolRenderingMode(.palette)
            .font(.system(size: size))
            .foregroundStyle(first, second, third)
    }
}

// MARK: - Timeline

struct Entry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), payload: PayloadStore.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), payload: PayloadStore.load() ?? PayloadStore.placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let payload = PayloadStore.load() ?? PayloadStore.placeholder
        let entry = Entry(date: Date(), payload: payload)
        // The app reloads timelines itself after each background refresh, so this
        // interval is only a floor for the case where it has not run.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Shared pieces

/// The location line. Green only when a station backs it — design rule 1.
private struct LocationLine: View {
    let payload: WidgetPayload
    var compact: Bool = false

    var body: some View {
        HStack(spacing: 5) {
            if payload.station {
                Circle()
                    .fill(Color("WidgetAgro"))
                    .frame(width: 6, height: 6)
            }
            Text(payload.locationName)
                .font(.system(size: compact ? 12 : 13, weight: .semibold))
                .foregroundStyle(payload.station ? Color("WidgetAgro") : Color("WidgetInk"))
                .lineLimit(1)
        }
    }
}

private struct HighLow: View {
    let payload: WidgetPayload

    var body: some View {
        HStack(spacing: 6) {
            Text(payload.high)
                .foregroundStyle(Color("WidgetHigh"))
            Text(payload.low)
                .foregroundStyle(Color("WidgetLow"))
        }
        .font(.system(size: 13, weight: .semibold))
        .monospacedDigit()
    }
}

private struct HourColumn: View {
    let hour: WidgetHour

    var body: some View {
        VStack(spacing: 4) {
            Text(hour.label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color("WidgetMuted"))
            WeatherGlyph(symbol: hour.symbol, size: 15)
            Text(hour.temp)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color("WidgetInk"))
            Text(hour.mm)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(hour.wet ? Color("WidgetAccent") : Color("WidgetMuted"))
        }
        .monospacedDigit()
    }
}

private struct DayRow: View {
    let day: WidgetDay

    var body: some View {
        HStack(spacing: 8) {
            Text(day.label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color("WidgetInk"))
                .frame(width: 24, alignment: .leading)

            WeatherGlyph(symbol: day.symbol, size: 13)
                .frame(width: 18)

            Text(day.low)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color("WidgetLow"))
                .frame(width: 30, alignment: .trailing)

            // The bar spans this day's low to high across a scale shared by every
            // day shown, so the column can be read downward.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color("WidgetMuted").opacity(0.18))
                        .frame(height: 4)
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [Color("WidgetLow"), Color("WidgetSun")],
                                startPoint: .leading, endPoint: .trailing
                            )
                        )
                        .frame(width: max(4, geo.size.width * day.barWidth), height: 4)
                        .offset(x: geo.size.width * day.barLeft)
                }
                .frame(height: geo.size.height, alignment: .center)
            }
            .frame(height: 12)

            Text(day.high)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color("WidgetHigh"))
                .frame(width: 30, alignment: .leading)
        }
        .monospacedDigit()
    }
}

// MARK: - Home screen

struct SmallWidget: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            LocationLine(payload: payload, compact: true)

            HStack(alignment: .firstTextBaseline) {
                Text(payload.temp)
                    .font(.system(size: 40, weight: .heavy))
                    .foregroundStyle(Color("WidgetInk"))
                    .monospacedDigit()
                Spacer(minLength: 0)
                WeatherGlyph(symbol: payload.symbol, size: 26)
            }

            HighLow(payload: payload)

            Spacer(minLength: 0)

            // An alert replaces the condition line, because when something is
            // happening that is the only thing worth the space.
            if let headline = payload.alertHeadline {
                Text(headline)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color("WidgetAccent"))
                    .lineLimit(2)
            } else {
                Text(payload.condition)
                    .font(.system(size: 11))
                    .foregroundStyle(Color("WidgetMuted"))
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

struct MediumWidget: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                LocationLine(payload: payload)
                Spacer()
                HighLow(payload: payload)
            }

            HStack(alignment: .center, spacing: 12) {
                Text(payload.temp)
                    .font(.system(size: 34, weight: .heavy))
                    .foregroundStyle(Color("WidgetInk"))
                    .monospacedDigit()
                WeatherGlyph(symbol: payload.symbol, size: 22)

                Spacer(minLength: 0)

                HStack(spacing: 10) {
                    ForEach(payload.hours.prefix(5)) { HourColumn(hour: $0) }
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

struct LargeWidget: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                LocationLine(payload: payload)
                Spacer()
                Text(payload.updatedAt, style: .time)
                    .font(.system(size: 11))
                    .foregroundStyle(Color("WidgetMuted"))
            }

            HStack(alignment: .center, spacing: 12) {
                Text(payload.temp)
                    .font(.system(size: 44, weight: .heavy))
                    .foregroundStyle(Color("WidgetInk"))
                    .monospacedDigit()
                VStack(alignment: .leading, spacing: 2) {
                    HighLow(payload: payload)
                    Text(payload.condition)
                        .font(.system(size: 11))
                        .foregroundStyle(Color("WidgetMuted"))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                WeatherGlyph(symbol: payload.symbol, size: 32)
            }

            if let headline = payload.alertHeadline {
                Text(headline)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color("WidgetAccent"))
                    .lineLimit(2)
            }

            HStack(spacing: 10) {
                ForEach(payload.hours.prefix(6)) { HourColumn(hour: $0) }
            }

            Divider().overlay(Color("WidgetMuted").opacity(0.2))

            VStack(spacing: 6) {
                ForEach(payload.days.prefix(5)) { DayRow(day: $0) }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Lock screen

struct CircularWidget: View {
    let payload: WidgetPayload

    var body: some View {
        // Accessory widgets are rendered as a stencil, so colour is unavailable and
        // the glyph has to carry the meaning on its own.
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: payload.symbol)
                    .font(.system(size: 14))
                Text(payload.temp)
                    .font(.system(size: 15, weight: .semibold))
                    .monospacedDigit()
            }
        }
    }
}

struct RectangularWidget: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: payload.symbol)
                    .font(.system(size: 12))
                Text(payload.locationName)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
            }
            Text("\(payload.temp)  \(payload.high) / \(payload.low)")
                .font(.system(size: 14, weight: .medium))
                .monospacedDigit()
            Text(payload.alertHeadline ?? payload.condition)
                .font(.system(size: 11))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct InlineWidget: View {
    let payload: WidgetPayload

    var body: some View {
        // Inline accessories are a single line beside the clock, so this is the
        // shortest true sentence available.
        Label(
            "\(payload.temp) · \(payload.precip24) mm",
            systemImage: payload.symbol
        )
    }
}

// MARK: - Entry point

struct ExactCastWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: Provider.Entry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidget(payload: entry.payload)
        case .systemMedium:
            MediumWidget(payload: entry.payload)
        case .systemLarge:
            LargeWidget(payload: entry.payload)
        case .accessoryCircular:
            CircularWidget(payload: entry.payload)
        case .accessoryRectangular:
            RectangularWidget(payload: entry.payload)
        case .accessoryInline:
            InlineWidget(payload: entry.payload)
        default:
            SmallWidget(payload: entry.payload)
        }
    }
}

@main
struct ExactCastWidget: Widget {
    let kind = "ExactCastWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            ExactCastWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    Color("WidgetBackground")
                }
        }
        .configurationDisplayName("ExactCast")
        .description("Het weer op je gekozen locatie.")
        .supportedFamilies([
            .systemSmall, .systemMedium, .systemLarge,
            .accessoryCircular, .accessoryRectangular, .accessoryInline,
        ])
    }
}
