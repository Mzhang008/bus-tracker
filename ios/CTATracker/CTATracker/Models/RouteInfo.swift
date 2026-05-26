import Foundation

struct RouteInfo: Codable, Identifiable {
    let route_id: String
    let route_short_name: String
    let route_long_name: String
    let route_color: String
    let route_type: String

    var id: String { route_id }
    var isBus: Bool { route_type == "bus" }
    var isRail: Bool { route_type == "rail" }
}
