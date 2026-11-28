import SwiftUI

/// Fades a background color in behind bottom navigation chrome so Liquid Glass stays legible over
/// busy / colorful / scrolling content. Apply with `.deliquify()` on a scrollable container.
///
/// Source pattern from Conor Luddy's iOS 26 Liquid Glass reference
/// (https://github.com/conorluddy/LiquidGlassReference).
struct TabBarFadeModifier: ViewModifier {
    let fadeLocation: CGFloat = 0.4
    let opacity: CGFloat = 0.85
    let backgroundColor: Color = Color(.systemBackground)

    func body(content: Content) -> some View {
        GeometryReader { geometry in
            ZStack {
                content

                if geometry.safeAreaInsets.bottom > 10 {
                    let dynamicHeight = geometry.safeAreaInsets.bottom

                    VStack {
                        Spacer()
                        LinearGradient(
                            gradient: Gradient(stops: [
                                .init(color: .clear, location: 0.0),
                                .init(color: backgroundColor.opacity(opacity), location: fadeLocation)
                            ]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(height: dynamicHeight)
                        .allowsHitTesting(false)
                        .offset(y: geometry.safeAreaInsets.bottom)
                    }
                }
            }
        }
    }
}

extension View {
    func deliquify() -> some View {
        self.modifier(TabBarFadeModifier())
    }
}
