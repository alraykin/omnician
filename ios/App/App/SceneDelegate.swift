import Capacitor
import os
import UIKit

/// iOS 27 SDK apps must use the UIScene lifecycle or UIKit traps during scene
/// connection (EXC_BREAKPOINT in FrontBoardServices, no app frames).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    private let log = Logger(subsystem: "app.omnician", category: "scene")

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = OmnicianBridgeViewController()
        self.window = window
        window.makeKeyAndVisible()
        let bounds = window.bounds.size
        let connected = String(format: "OmnicianScene: window connected bounds=%.0fx%.0f", bounds.width, bounds.height)
        log.notice("\(connected, privacy: .public)")
        NSLog("%@", connected)
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
