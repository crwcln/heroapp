import SwiftUI

/// Applies Liquid Glass on iOS 26+ and a hand-built frosted fallback on iOS 18, so the same view
/// code runs on both. Use `.glassedEffect(in:interactive:)` in place of `.glassEffect(...)`.
///
/// Source pattern from Conor Luddy's iOS 26 Liquid Glass reference
/// (https://github.com/conorluddy/LiquidGlassReference).
extension View {
    @ViewBuilder
    func glassedEffect(
        in shape: some Shape = Capsule(),
        interactive: Bool = false
    ) -> some View {
        if #available(iOS 26.0, *) {
            let glass = interactive ? Glass.regular.interactive() : .regular
            self.glassEffect(glass, in: shape)
        } else {
            // Fallback for iOS 18
            self
                .background(
                    shape
                        .fill(.ultraThinMaterial)
                        .overlay(
                            LinearGradient(
                                colors: [.white.opacity(0.3), .clear],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(shape.stroke(.white.opacity(0.2), lineWidth: 1))
                )
        }
    }
}
