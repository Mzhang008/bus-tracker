import SwiftUI

struct ContentView: View {
    @Environment(TransitStore.self) private var store

    var body: some View {
        ZStack {
            TransitMapView()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                if let error = store.error {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 12))
                        Text(error)
                            .font(.system(size: 12))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 12)
                    .background(Color(hex: "d32f2f"))
                }

                HStack(alignment: .top, spacing: 8) {
                    FilterMenu()
                    Spacer()
                    InfoBanner()
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)

                Spacer()
            }

            if store.availableRoutes.isEmpty, store.error != nil {
                VStack(spacing: 12) {
                    Image(systemName: "wifi.slash")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("Could not connect")
                        .font(.headline)
                    Text(store.error ?? "Check your connection and try again")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Retry") { store.retryLoading() }
                        .buttonStyle(.bordered)
                }
                .padding(24)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
    }
}
