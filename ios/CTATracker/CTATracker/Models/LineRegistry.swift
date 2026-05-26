import SwiftUI

struct LineDef {
    let canonical: String
    let color: Color
    let aliases: [String]
}

struct ResolvedLine {
    let color: Color
    let name: String
}

enum LineRegistry {
    static let lines: [LineDef] = [
        LineDef(canonical: "Red",    color: Color(hex: "c62828"), aliases: ["red", "r"]),
        LineDef(canonical: "Blue",   color: Color(hex: "1565c0"), aliases: ["blue", "bl"]),
        LineDef(canonical: "Brown",  color: Color(hex: "6d4c41"), aliases: ["brn", "brown", "br"]),
        LineDef(canonical: "Green",  color: Color(hex: "2e7d32"), aliases: ["g", "grn", "green", "gr"]),
        LineDef(canonical: "Orange", color: Color(hex: "ef6c00"), aliases: ["org", "orange", "o"]),
        LineDef(canonical: "Purple", color: Color(hex: "6a1b9a"), aliases: ["p", "pur", "purp", "purple"]),
        LineDef(canonical: "Pink",   color: Color(hex: "e91e63"), aliases: ["pink", "pnk", "pk"]),
        LineDef(canonical: "Yellow", color: Color(hex: "f9a825"), aliases: ["y", "yel", "yellow"]),
    ]

    private static let byAlias: [String: LineDef] = {
        var map: [String: LineDef] = [:]
        for def in lines {
            for a in def.aliases { map[a] = def }
            map[def.canonical.lowercased()] = def
        }
        return map
    }()

    static func resolve(_ route: String?) -> ResolvedLine? {
        guard let route, !route.isEmpty else { return nil }
        let key = route.lowercased().filter { $0.isLetter }
        guard !key.isEmpty else { return nil }

        if let def = byAlias[key] {
            return ResolvedLine(color: def.color, name: "\(def.canonical) Line")
        }

        for def in lines {
            if key.hasPrefix(def.canonical.lowercased()) ||
               def.aliases.contains(where: { $0.count > 1 && key.hasPrefix($0) }) {
                return ResolvedLine(color: def.color, name: "\(def.canonical) Line")
            }
        }

        if key.count == 1 {
            let letterMap: [Character: String] = [
                "r": "Red", "b": "Blue", "g": "Green",
                "o": "Orange", "p": "Purple", "y": "Yellow",
            ]
            if let first = key.first,
               let canon = letterMap[first],
               let def = lines.first(where: { $0.canonical == canon }) {
                return ResolvedLine(color: def.color, name: "\(def.canonical) Line")
            }
        }

        return nil
    }

    static let busColor = Color(hex: "1b5e20")

    static func vehicleColor(_ vehicle: InterpolatedVehicle) -> Color {
        if vehicle.vehicle.type == .train {
            return resolve(vehicle.vehicle.route)?.color ?? .gray
        }
        return busColor
    }
}

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var rgb: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
