import SwiftUI

@main
struct CTATrackerApp: App {
    @State private var store = TransitStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
        }
    }
}
