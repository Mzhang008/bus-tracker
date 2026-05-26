import Foundation
import SwiftUI

@Observable
@MainActor
final class TransitStore {
    var vehicles: [InterpolatedVehicle] = []
    var availableRoutes: [RouteInfo] = []
    var selectedRoutes: Set<String> = []
    var routeShapes: GeoJSONFeatureCollection?

    var showBusVehicles = false
    var showTrainVehicles = false
    var showBusRoutes = false
    var showTrainRoutes = false

    var loading = false
    var error: String?

    private var rawVehicles: [Vehicle] = []
    private var vehicleStates: [String: VehicleState] = [:]
    private var pollTask: Task<Void, Never>?
    private var tickTask: Task<Void, Never>?

    private static let pollInterval: TimeInterval = 15
    private static let tickInterval: TimeInterval = 1
    private static let storageKey = "cta-tracker.selectedRoutes"

    private struct VehicleState {
        var prev: Vehicle
        var next: Vehicle
        var fetchedAt: Date
        var lastHeading: Double
    }

    nonisolated init() {}

    // MARK: - Computed

    var visibleVehicles: [InterpolatedVehicle] {
        vehicles.filter { $0.vehicle.type == .bus ? showBusVehicles : showTrainVehicles }
    }

    var busRoutes: [RouteInfo] {
        availableRoutes.filter(\.isBus).sorted {
            if let a = Int($0.route_short_name), let b = Int($1.route_short_name) { return a < b }
            return $0.route_short_name < $1.route_short_name
        }
    }

    var railRoutes: [RouteInfo] {
        availableRoutes.filter(\.isRail).sorted { $0.route_long_name < $1.route_long_name }
    }

    // MARK: - Lifecycle

    func startPolling() {
        if selectedRoutes.isEmpty,
           let saved = UserDefaults.standard.stringArray(forKey: Self.storageKey) {
            selectedRoutes = Set(saved)
        }
        pollTask = Task {
            await fetchRouteData()
            await fetchVehicles()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Self.pollInterval))
                await fetchVehicles()
            }
        }
        tickTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Self.tickInterval))
                tick()
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
        tickTask?.cancel()
        tickTask = nil
    }

    // MARK: - Actions

    func toggleRoute(_ routeId: String) {
        if selectedRoutes.contains(routeId) {
            selectedRoutes.remove(routeId)
        } else {
            selectedRoutes.insert(routeId)
            if let meta = availableRoutes.first(where: { $0.route_id == routeId }) {
                if meta.isBus { showBusVehicles = true; showBusRoutes = true }
                else if meta.isRail { showTrainVehicles = true; showTrainRoutes = true }
            }
        }
        persistSelection()
        Task { await fetchVehicles() }
    }

    func selectAllOfType(_ type: String) {
        let ids = availableRoutes.filter { $0.route_type == type }.map(\.route_id)
        selectedRoutes.formUnion(ids)
        if type == "bus" { showBusVehicles = true; showBusRoutes = true }
        else { showTrainVehicles = true; showTrainRoutes = true }
        persistSelection()
        Task { await fetchVehicles() }
    }

    func clearAllOfType(_ type: String) {
        let ids = Set(availableRoutes.filter { $0.route_type == type }.map(\.route_id))
        selectedRoutes.subtract(ids)
        persistSelection()
        Task { await fetchVehicles() }
    }

    // MARK: - Network

    private func fetchRouteData() async {
        do {
            async let s = TransitAPI.fetchRouteShapes()
            async let r = TransitAPI.fetchAvailableRoutes()
            let (shapes, routes) = try await (s, r)
            routeShapes = shapes
            availableRoutes = routes
            if !selectedRoutes.isEmpty { await fetchVehicles() }
        } catch {
            print("[TransitStore] route data load failed: \(error.localizedDescription)")
        }
    }

    private func fetchVehicles() async {
        guard !selectedRoutes.isEmpty, !availableRoutes.isEmpty else {
            updateVehiclePositions([])
            rawVehicles = []
            vehicles = []
            self.error = nil
            return
        }

        let typeById = Dictionary(uniqueKeysWithValues: availableRoutes.map { ($0.route_id, $0.route_type) })
        var busIds: [String] = []
        var railIds: [String] = []
        for id in selectedRoutes {
            if typeById[id] == "rail" { railIds.append(id) }
            else if typeById[id] == "bus" { busIds.append(id) }
        }

        loading = true
        do {
            async let buses = busIds.isEmpty ? [] : TransitAPI.fetchBusVehicles(routes: busIds.joined(separator: ","))
            async let trains = railIds.isEmpty ? [] : TransitAPI.fetchTrainPositions(routes: railIds.joined(separator: ","))
            let all = try await buses + trains
            updateVehiclePositions(all)
            rawVehicles = all
            vehicles = interpolatedPositions()
            loading = false
            self.error = nil
        } catch {
            loading = false
            self.error = error.localizedDescription
        }
    }

    // MARK: - Interpolation

    private func updateVehiclePositions(_ fresh: [Vehicle]) {
        let now = Date()
        for v in fresh {
            let existing = vehicleStates[v.id]
            let prev = existing?.next ?? v
            let heading = GeoMath.resolveHeading(prev: prev, next: v, lastHeading: existing?.lastHeading ?? 0)
            vehicleStates[v.id] = VehicleState(prev: prev, next: v, fetchedAt: now, lastHeading: heading)
        }
        let active = Set(fresh.map(\.id))
        vehicleStates = vehicleStates.filter { active.contains($0.key) }
    }

    private func tick() {
        vehicles = interpolatedPositions()
    }

    private func interpolatedPositions() -> [InterpolatedVehicle] {
        let now = Date()
        return vehicleStates.values.map { state in
            let elapsed = now.timeIntervalSince(state.fetchedAt)
            let t = min(elapsed / Self.pollInterval, 1)

            let lat: Double
            let lon: Double

            if t >= 1 || (state.prev.lat == state.next.lat && state.prev.lon == state.next.lon) {
                lat = state.next.lat
                lon = state.next.lon
            } else if state.next.speed > 0 {
                let distMiles = state.next.speed * (elapsed / 3600)
                let proj = GeoMath.destination(
                    lat: state.prev.lat, lon: state.prev.lon,
                    distanceMiles: distMiles, bearingDeg: state.next.heading
                )
                lat = proj.lat + (state.next.lat - proj.lat) * t
                lon = proj.lon + (state.next.lon - proj.lon) * t
            } else {
                lat = state.prev.lat + (state.next.lat - state.prev.lat) * t
                lon = state.prev.lon + (state.next.lon - state.prev.lon) * t
            }

            return InterpolatedVehicle(
                vehicle: state.next,
                displayLat: lat, displayLon: lon,
                displayHeading: state.lastHeading
            )
        }
    }

    private func persistSelection() {
        UserDefaults.standard.set(Array(selectedRoutes), forKey: Self.storageKey)
    }
}
