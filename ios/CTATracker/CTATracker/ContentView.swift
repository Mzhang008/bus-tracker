import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack(alignment: .top) {
            TransitMapView()
                .ignoresSafeArea()

            HStack(alignment: .top, spacing: 8) {
                FilterMenu()
                Spacer()
                InfoBanner()
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
        }
    }
}
