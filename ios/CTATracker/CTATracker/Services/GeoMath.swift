import Foundation

enum GeoMath {
    private static let earthRadius: Double = 6_371_000
    private static let minBearingDistance: Double = 5

    static func bearingBetween(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        if lat1 == lat2 && lon1 == lon2 { return .nan }
        let φ1 = lat1 * .pi / 180
        let φ2 = lat2 * .pi / 180
        let Δλ = (lon2 - lon1) * .pi / 180
        let y = sin(Δλ) * cos(φ2)
        let x = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(Δλ)
        return (atan2(y, x) * 180 / .pi + 360).truncatingRemainder(dividingBy: 360)
    }

    static func distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        let φ1 = lat1 * .pi / 180
        let φ2 = lat2 * .pi / 180
        let Δφ = (lat2 - lat1) * .pi / 180
        let Δλ = (lon2 - lon1) * .pi / 180
        let a = pow(sin(Δφ / 2), 2) + cos(φ1) * cos(φ2) * pow(sin(Δλ / 2), 2)
        return 2 * earthRadius * asin(sqrt(a))
    }

    static func destination(lat: Double, lon: Double, distanceMiles: Double, bearingDeg: Double) -> (lat: Double, lon: Double) {
        let d = distanceMiles * 1609.344
        let φ1 = lat * .pi / 180
        let λ1 = lon * .pi / 180
        let θ = bearingDeg * .pi / 180
        let δ = d / earthRadius

        let φ2 = asin(sin(φ1) * cos(δ) + cos(φ1) * sin(δ) * cos(θ))
        let λ2 = λ1 + atan2(sin(θ) * sin(δ) * cos(φ1), cos(δ) - sin(φ1) * sin(φ2))

        return (lat: φ2 * 180 / .pi, lon: λ2 * 180 / .pi)
    }

    static func resolveHeading(prev: Vehicle, next: Vehicle, lastHeading: Double) -> Double {
        if next.heading.isFinite && next.heading > 0 {
            return next.heading
        }
        let dist = distanceMeters(lat1: prev.lat, lon1: prev.lon, lat2: next.lat, lon2: next.lon)
        if dist >= minBearingDistance {
            let b = bearingBetween(lat1: prev.lat, lon1: prev.lon, lat2: next.lat, lon2: next.lon)
            if b.isFinite { return b }
        }
        return lastHeading
    }
}
