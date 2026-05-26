import Foundation
import CoreLocation

enum VehicleType: String, Codable {
    case bus
    case train
}

struct Vehicle: Identifiable, Codable {
    let id: String
    let type: VehicleType
    let lat: Double
    let lon: Double
    let heading: Double
    let speed: Double
    let route: String
    let destination: String
    let timestamp: String

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}

struct InterpolatedVehicle: Identifiable {
    let vehicle: Vehicle
    var displayLat: Double
    var displayLon: Double
    var displayHeading: Double

    var id: String { vehicle.id }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: displayLat, longitude: displayLon)
    }
}
