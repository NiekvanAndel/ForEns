import Foundation

/// The payload the app writes into the shared App Group container.
///
/// This mirrors `core/widget.ts` exactly. Every string arrives pre-formatted —
/// units already converted, decimals already commas, day names already translated —
/// so the widget lays out text and never re-implements the app's formatting. A
/// change to the user's unit preference therefore needs no Swift change.
struct WidgetPayload: Codable {
    let version: Int
    let updatedMs: Double
    let locationName: String
    /// True when an AgroExact station backs this location. It is the only case in
    /// which the design allows green, so it drives colour as well as content.
    let station: Bool
    let stationName: String?
    let temp: String
    let high: String
    let low: String
    let condition: String
    let symbol: String
    let wind: String
    let windUnit: String
    let precip24: String
    let humidity: String
    let alertKind: String?
    let alertHeadline: String?
    let hours: [WidgetHour]
    let days: [WidgetDay]
    let nowcastBars: [Double]

    var updatedAt: Date { Date(timeIntervalSince1970: updatedMs / 1000) }
}

struct WidgetHour: Codable, Identifiable {
    let label: String
    let temp: String
    let mm: String
    let symbol: String
    let wet: Bool

    var id: String { label }
}

struct WidgetDay: Codable, Identifiable {
    let label: String
    let high: String
    let low: String
    let mm: String
    let symbol: String
    let barLeft: Double
    let barWidth: Double

    var id: String { label }
}

enum PayloadStore {
    /// Must match `ios.entitlements` in app.json and the `extra.appGroup` value.
    static let appGroup = "group.com.agroexact.exactcast"
    static let key = "exactcast.widget.payload"

    /// The most recent payload the app wrote, or nil when it has never run.
    static func load() -> WidgetPayload? {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let raw = defaults.string(forKey: key),
            let data = raw.data(using: .utf8)
        else { return nil }

        do {
            let payload = try JSONDecoder().decode(WidgetPayload.self, from: data)
            // A payload written by a newer app than this widget binary may not have
            // the shape decoded above; refusing it shows the placeholder instead of
            // rendering something wrong.
            guard payload.version == 1 else { return nil }
            return payload
        } catch {
            return nil
        }
    }

    /// Shown in the widget gallery and before the app has ever been opened.
    static var placeholder: WidgetPayload {
        WidgetPayload(
            version: 1,
            updatedMs: Date().timeIntervalSince1970 * 1000,
            locationName: "'s-Hertogenbosch",
            station: true,
            stationName: "Rosmalen",
            temp: "18°",
            high: "22°",
            low: "11°",
            condition: "Gedeeltelijk bewolkt",
            symbol: "cloud.sun.fill",
            wind: "14",
            windUnit: "km/u",
            precip24: "1,2",
            humidity: "68",
            alertKind: nil,
            alertHeadline: nil,
            hours: [
                WidgetHour(label: "14", temp: "18°", mm: "0,0", symbol: "cloud.sun.fill", wet: false),
                WidgetHour(label: "15", temp: "19°", mm: "0,4", symbol: "cloud.rain.fill", wet: true),
                WidgetHour(label: "16", temp: "19°", mm: "1,1", symbol: "cloud.rain.fill", wet: true),
                WidgetHour(label: "17", temp: "18°", mm: "0,2", symbol: "cloud.sun.fill", wet: true),
                WidgetHour(label: "18", temp: "17°", mm: "0,0", symbol: "cloud.fill", wet: false),
                WidgetHour(label: "19", temp: "16°", mm: "0,0", symbol: "cloud.fill", wet: false),
            ],
            days: [
                WidgetDay(label: "ma", high: "22°", low: "11°", mm: "1,2", symbol: "cloud.sun.fill", barLeft: 0.0, barWidth: 0.6),
                WidgetDay(label: "di", high: "24°", low: "13°", mm: "0,0", symbol: "sun.max.fill", barLeft: 0.15, barWidth: 0.6),
                WidgetDay(label: "wo", high: "21°", low: "14°", mm: "4,5", symbol: "cloud.rain.fill", barLeft: 0.2, barWidth: 0.4),
                WidgetDay(label: "do", high: "19°", low: "12°", mm: "2,1", symbol: "cloud.rain.fill", barLeft: 0.1, barWidth: 0.4),
                WidgetDay(label: "vr", high: "23°", low: "12°", mm: "0,0", symbol: "sun.max.fill", barLeft: 0.1, barWidth: 0.65),
            ],
            nowcastBars: [4, 28, 62, 12]
        )
    }
}
