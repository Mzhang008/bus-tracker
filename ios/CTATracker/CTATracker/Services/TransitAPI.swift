import Foundation

enum TransitAPIError: LocalizedError {
    case invalidURL
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .httpError(let code): return "HTTP \(code)"
        }
    }
}

enum TransitAPI {
    static var baseURL: String {
        Bundle.main.object(forInfoDictionaryKey: "CTAAPIBaseURL") as? String
            ?? "https://cta-transit-tracker.pages.dev/api"
    }

    struct VehiclesResponse: Codable {
        let vehicles: [Vehicle]
    }

    static func fetchBusVehicles(routes: String) async throws -> [Vehicle] {
        let encoded = routes.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? routes
        let data: VehiclesResponse = try await fetch("/buses/vehicles?routes=\(encoded)")
        return data.vehicles
    }

    static func fetchTrainPositions(routes: String) async throws -> [Vehicle] {
        let encoded = routes.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? routes
        let data: VehiclesResponse = try await fetch("/trains/positions?routes=\(encoded)")
        return data.vehicles
    }

    struct RoutesListResponse: Codable {
        let routes: [RouteInfo]
    }

    static func fetchAvailableRoutes() async throws -> [RouteInfo] {
        let data: RoutesListResponse = try await fetch("/static/routes")
        return data.routes
    }

    static func fetchRouteShapes() async throws -> GeoJSONFeatureCollection {
        return try await fetch("/static/routes.geojson", timeout: 30)
    }

    private static func fetch<T: Decodable>(_ path: String, timeout: TimeInterval = 10) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw TransitAPIError.invalidURL
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = timeout

        let (data, response) = try await URLSession.shared.data(for: request)

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            throw TransitAPIError.httpError(http.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - GeoJSON Types

struct GeoJSONFeatureCollection: Decodable {
    let type: String
    let features: [GeoJSONFeature]
}

struct GeoJSONFeature: Decodable {
    let type: String
    let properties: GeoJSONProperties
    let geometry: GeoJSONGeometry
}

struct GeoJSONProperties: Decodable {
    let route_id: String?
    let route_color: String?
    let route_type: String?
    let route_short_name: String?
    let route_long_name: String?

    enum CodingKeys: String, CodingKey {
        case route_id, route_color, route_type, route_short_name, route_long_name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        route_id = try c.decodeIfPresent(String.self, forKey: .route_id)
        route_color = try c.decodeIfPresent(String.self, forKey: .route_color)
        route_type = try c.decodeIfPresent(String.self, forKey: .route_type)
        route_short_name = try c.decodeIfPresent(String.self, forKey: .route_short_name)
        route_long_name = try c.decodeIfPresent(String.self, forKey: .route_long_name)
    }
}

struct GeoJSONGeometry: Decodable {
    let type: String
    let coordinates: GeoJSONCoordinates
}

enum GeoJSONCoordinates: Decodable {
    case lineString([[Double]])
    case multiLineString([[[Double]]])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let multi = try? container.decode([[[Double]]].self) {
            self = .multiLineString(multi)
        } else if let line = try? container.decode([[Double]].self) {
            self = .lineString(line)
        } else {
            self = .lineString([])
        }
    }

    var asLineArrays: [[[Double]]] {
        switch self {
        case .lineString(let line): return [line]
        case .multiLineString(let lines): return lines
        }
    }
}
