import SwiftUI

// Complete iOS 26 Liquid Glass sample app. Demonstrates a glass TabView with a search tab,
// tab-bar minimize behavior, a bottom "Now Playing" accessory, a toolbar with a badge, and a
// morphing floating action button built with GlassEffectContainer + glassEffectID.
//
// Source: Conor Luddy's iOS 26 Liquid Glass reference
// (https://github.com/conorluddy/LiquidGlassReference).

@main
struct LiquidGlassApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var selectedTab = 0
    @State private var searchText = ""

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Home", systemImage: "house", value: 0) {
                HomeView()
            }

            Tab("Favorites", systemImage: "star", value: 1) {
                FavoritesView()
            }

            Tab("Search", systemImage: "magnifyingglass", value: 2, role: .search) {
                NavigationStack {
                    SearchView(searchText: $searchText)
                }
            }
        }
        .searchable(text: $searchText)
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory {
            if selectedTab == 0 {
                NowPlayingView()
            }
        }
    }
}

struct HomeView: View {
    @State private var showActions = false
    @Namespace private var namespace

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 20) {
                    ForEach(0..<20) { index in
                        ContentCard(index: index)
                    }
                }
                .padding()
            }
            .navigationTitle("Home")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Notifications", systemImage: "bell") {
                        // action
                    }
                    .badge(3)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                FloatingActionButton(showActions: $showActions, namespace: namespace)
                    .padding()
            }
        }
    }
}

struct ContentCard: View {
    let index: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: "photo.fill")
                .font(.system(size: 60))
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .background(Color.blue.opacity(0.3))
                .clipShape(RoundedRectangle(cornerRadius: 12))

            Text("Item \(index + 1)")
                .font(.headline)

            Text("Description for item \(index + 1)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct FloatingActionButton: View {
    @Binding var showActions: Bool
    var namespace: Namespace.ID

    let actions = [
        ("photo", "Photo", Color.blue),
        ("video", "Video", Color.purple),
        ("doc.text", "Document", Color.green)
    ]

    var body: some View {
        GlassEffectContainer(spacing: 16) {
            VStack(spacing: 12) {
                if showActions {
                    ForEach(actions, id: \.0) { action in
                        actionButton(icon: action.0, label: action.1, color: action.2)
                            .glassEffectID(action.0, in: namespace)
                    }
                }

                Button {
                    withAnimation(.bouncy(duration: 0.35)) {
                        showActions.toggle()
                    }
                } label: {
                    Image(systemName: showActions ? "xmark" : "plus")
                        .font(.title2.bold())
                        .frame(width: 56, height: 56)
                }
                .buttonStyle(.glassProminent)
                .buttonBorderShape(.circle)
                .tint(.orange)
                .glassEffectID("toggle", in: namespace)
            }
        }
    }

    func actionButton(icon: String, label: String, color: Color) -> some View {
        Button {
            // action
        } label: {
            HStack {
                Image(systemName: icon)
                if showActions {
                    Text(label)
                        .font(.callout.bold())
                }
            }
            .frame(height: 48)
            .padding(.horizontal, showActions ? 16 : 12)
        }
        .buttonStyle(.glass)
        .tint(color)
    }
}

struct NowPlayingView: View {
    @Environment(\.tabViewBottomAccessoryPlacement) var placement

    var body: some View {
        HStack {
            Image(systemName: "music.note")
                .font(.title3)

            VStack(alignment: .leading, spacing: 2) {
                Text("Song Title")
                    .font(.subheadline.bold())
                Text("Artist Name")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button(action: {}) {
                Image(systemName: "play.fill")
            }
            .buttonStyle(.glass)
            .controlSize(.small)
        }
        .padding()
        .opacity(placement == .collapsed ? 0.7 : 1.0)
    }
}

struct FavoritesView: View {
    var body: some View {
        NavigationStack {
            List {
                ForEach(0..<10) { index in
                    HStack {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                        Text("Favorite \(index + 1)")
                    }
                }
            }
            .navigationTitle("Favorites")
        }
    }
}

struct SearchView: View {
    @Binding var searchText: String

    var body: some View {
        List {
            if searchText.isEmpty {
                Text("Start typing to search")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(0..<5) { index in
                    Text("Result \(index + 1) for '\(searchText)'")
                }
            }
        }
        .navigationTitle("Search")
    }
}
