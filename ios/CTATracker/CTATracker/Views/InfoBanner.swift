import SwiftUI

struct InfoBanner: View {
    @State private var collapsed = false
    @State private var now = Date()
    @State private var weather: WeatherData?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { collapsed.toggle() }
            } label: {
                HStack {
                    Text("Chi Transit")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: "212121"))
                    Spacer(minLength: 8)
                    Text(collapsed ? "\u{25BC}" : "\u{25B2}")
                        .font(.system(size: 12))
                        .foregroundStyle(.gray)
                }
            }

            if !collapsed {
                Text("\(timeString) \u{00B7} \(dateString)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "424242"))
                    .padding(.top, 4)

                if let weather {
                    Text("\(weather.emoji) \(weather.tempF)\u{00B0}F \u{00B7} \(weather.label)")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "424242"))
                        .padding(.top, 4)
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.25), radius: 6, y: 2)
        .task { await clockLoop() }
        .task { await weatherLoop() }
    }

    // MARK: - Clock

    nonisolated(unsafe) private static let timeFmt: DateFormatter = {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "America/Chicago")
        f.dateFormat = "h:mm a"
        return f
    }()

    nonisolated(unsafe) private static let dateFmt: DateFormatter = {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "America/Chicago")
        f.dateFormat = "EEE, MMM d"
        return f
    }()

    private var timeString: String { Self.timeFmt.string(from: now) + " CT" }
    private var dateString: String { Self.dateFmt.string(from: now) }

    private func clockLoop() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            now = Date()
        }
    }

    // MARK: - Weather

    struct WeatherData {
        let tempF: Int
        let emoji: String
        let label: String
    }

    private func weatherLoop() async {
        while !Task.isCancelled {
            await fetchWeather()
            try? await Task.sleep(for: .seconds(600))
        }
    }

    private func fetchWeather() async {
        guard let url = URL(string:
            "https://api.open-meteo.com/v1/forecast?latitude=41.8781&longitude=-87.6298&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Chicago"
        ) else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let current = json["current"] as? [String: Any],
                  let temp = current["temperature_2m"] as? Double,
                  let code = current["weather_code"] as? Int else { return }
            let (emoji, label) = describeWeather(code)
            weather = WeatherData(tempF: Int(temp.rounded()), emoji: emoji, label: label)
        } catch {
            // non-fatal
        }
    }

    private func describeWeather(_ code: Int) -> (String, String) {
        switch code {
        case 0:      return ("\u{2600}", "Clear")
        case 1:      return ("\u{1F324}", "Mostly clear")
        case 2:      return ("\u{26C5}", "Partly cloudy")
        case 3:      return ("\u{2601}", "Overcast")
        case 45, 48: return ("\u{1F32B}", "Fog")
        case 51...57: return ("\u{1F326}", "Drizzle")
        case 61...67: return ("\u{1F327}", "Rain")
        case 71...77: return ("\u{2744}", "Snow")
        case 80...82: return ("\u{1F327}", "Showers")
        case 85...86: return ("\u{2744}", "Snow showers")
        case 95...:  return ("\u{26C8}", "Thunderstorm")
        default:     return ("\u{2022}", "\u{2014}")
        }
    }
}
