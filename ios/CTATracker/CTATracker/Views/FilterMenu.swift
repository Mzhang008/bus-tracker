import SwiftUI

struct FilterMenu: View {
    @Environment(TransitStore.self) private var store
    @State private var activeTab = "bus"
    @State private var collapsed = false

    var body: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { collapsed.toggle() }
            } label: {
                HStack {
                    Text("Route Filters")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Color(hex: "212121"))
                    Spacer()
                    Text(collapsed ? "\u{25BC}" : "\u{25B2}")
                        .font(.system(size: 12))
                        .foregroundStyle(.gray)
                }
                .padding(.bottom, 6)
            }

            if !collapsed {
                HStack(spacing: 0) {
                    tabButton("Bus", tab: "bus")
                    tabButton("Train", tab: "rail")
                }
                .overlay(alignment: .bottom) { Divider() }
                .padding(.bottom, 6)

                HStack {
                    Button("Select all") { store.selectAllOfType(activeTab) }
                    Spacer()
                    Button("Clear") { store.clearAllOfType(activeTab) }
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color(hex: "1565c0"))
                .padding(.vertical, 4)

                if store.availableRoutes.isEmpty {
                    Text("Loading routes\u{2026}")
                        .font(.system(size: 12))
                        .foregroundStyle(.gray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(activeTab == "bus" ? store.busRoutes : store.railRoutes) { route in
                                routeRow(route)
                            }
                        }
                    }
                    .frame(maxHeight: 320)
                }

                Divider().padding(.top, 6)
                Text(statusText)
                    .font(.system(size: 11))
                    .foregroundStyle(.gray)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 6)
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .frame(width: 220)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.25), radius: 6, y: 2)
    }

    private var statusText: String {
        if store.loading { return "Updating\u{2026}" }
        if store.selectedRoutes.isEmpty { return "No routes selected" }
        return "\(store.selectedRoutes.count) routes \u{00B7} \(store.visibleVehicles.count) vehicles"
    }

    @ViewBuilder
    private func tabButton(_ label: String, tab: String) -> some View {
        Button {
            activeTab = tab
        } label: {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(activeTab == tab ? Color(hex: "1565c0") : .gray)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .overlay(alignment: .bottom) {
                    if activeTab == tab {
                        Rectangle().fill(Color(hex: "1565c0")).frame(height: 2)
                    }
                }
        }
    }

    @ViewBuilder
    private func routeRow(_ route: RouteInfo) -> some View {
        let checked = store.selectedRoutes.contains(route.route_id)
        Button { store.toggleRoute(route.route_id) } label: {
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(checked ? Color(hex: "1565c0") : .gray, lineWidth: 1.5)
                        .background(RoundedRectangle(cornerRadius: 3).fill(checked ? Color(hex: "1565c0") : .white))
                    if checked {
                        Text("\u{2713}")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 18, height: 18)

                RoundedRectangle(cornerRadius: 3)
                    .fill(Color(hex: route.route_color.isEmpty ? "888888" : route.route_color))
                    .frame(width: 14, height: 14)

                Text(activeTab == "bus"
                     ? "\(route.route_short_name)  \(route.route_long_name)"
                     : route.route_long_name.isEmpty ? route.route_short_name : route.route_long_name)
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "212121"))
                    .lineLimit(1)

                Spacer()
            }
            .padding(.vertical, 5)
        }
    }
}
