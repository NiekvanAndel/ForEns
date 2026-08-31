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
/// text and never computes weather.

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
            Image(systemName: hour.symbol)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 15))
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

            Image(systemName: day.symbol)
                .symbolRenderingMode(.multicolor)
                .font(.system(size: 13))
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
                Image(systemName: payload.symbol)
                    .symbolRenderingMode(.multicolor)
                    .font(.system(size: 26))
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
                Image(systemName: payload.symbol)
                    .symbolRenderingMode(.multicolor)
                    .font(.system(size: 22))

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
                Image(systemName: payload.symbol)
                    .symbolRenderingMode(.multicolor)
                    .font(.system(size: 32))
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
