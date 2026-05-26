import SwiftUI
import MapKit

struct TransitMapView: View {
    @Environment(TransitStore.self) private var store

    @State private var position: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 41.8781, longitude: -87.6298),
            span: MKCoordinateSpan(latitudeDelta: 0.15, longitudeDelta: 0.15)
        )
    )

    var body: some View {
        Map(position: $position) {
            ForEach(visiblePolylines) { polyline in
                MapPolyline(coordinates: polyline.coordinates)
                    .stroke(polyline.color, lineWidth: 3)
            }
            ForEach(store.visibleVehicles) { vehicle in
                Annotation("", coordinate: vehicle.coordinate, anchor: .center) {
                    ChevronMarker(vehicle: vehicle)
                }
            }
        }
        .onAppear { store.startPolling() }
        .onDisappear { store.stopPolling() }
    }

    private var visiblePolylines: [RoutePolyline] {
        guard let shapes = store.routeShapes else { return [] }
        var result: [RoutePolyline] = []
        for feature in shapes.features {
            guard let rid = feature.properties.route_id,
                  store.selectedRoutes.contains(rid) else { continue }
            let rtype = feature.properties.route_type ?? ""
            if rtype == "rail" && !store.showTrainRoutes { continue }
            if rtype != "rail" && !store.showBusRoutes { continue }

            let color = Color(hex: feature.properties.route_color ?? "888888")
            for (i, line) in feature.geometry.coordinates.asLineArrays.enumerated() {
                let coords = line.compactMap { pair -> CLLocationCoordinate2D? in
                    guard pair.count >= 2 else { return nil }
                    return CLLocationCoordinate2D(latitude: pair[1], longitude: pair[0])
                }
                if coords.count >= 2 {
                    result.append(RoutePolyline(id: "\(rid)-\(i)", coordinates: coords, color: color))
                }
            }
        }
        return result
    }
}

struct RoutePolyline: Identifiable {
    let id: String
    let coordinates: [CLLocationCoordinate2D]
    let color: Color
}

struct ChevronShape: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            let w = rect.width, h = rect.height
            p.move(to: CGPoint(x: w * 0.5, y: h * 0.0625))
            p.addLine(to: CGPoint(x: w * 0.875, y: h * 0.875))
            p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.6875))
            p.addLine(to: CGPoint(x: w * 0.125, y: h * 0.875))
            p.closeSubpath()
        }
    }
}

struct ChevronMarker: View {
    let vehicle: InterpolatedVehicle

    var body: some View {
        let color = LineRegistry.vehicleColor(vehicle)
        ZStack {
            ChevronShape()
                .fill(color)
                .overlay(ChevronShape().stroke(.white, lineWidth: 1.5))
            if vehicle.vehicle.type == .bus {
                Text(vehicle.vehicle.route)
                    .font(.system(size: 7, weight: .bold))
                    .foregroundStyle(.white)
                    .offset(y: 3)
            } else {
                Circle()
                    .fill(.white)
                    .frame(width: 5, height: 5)
                    .offset(y: 2)
            }
        }
        .frame(width: 28, height: 28)
        .rotationEffect(.degrees(vehicle.displayHeading))
        .shadow(color: .black.opacity(0.4), radius: 2, y: 1)
    }
}
