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
        // Exclusive playback session before WKWebView so Click/Drums ignore the ringer.
        OmnicianAudioPlugin.activatePlayback()
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

    func sceneWillEnterForeground(_ scene: UIScene) {
        OmnicianAudioPlugin.activatePlayback()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        OmnicianAudioPlugin.activatePlayback()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Keep Click/Drums running. Stop the tuner mic — getUserMedia must
        // not hold playAndRecord (or the mic LED) while the app is hidden.
        let js = "window.__OMNICIAN_AUDIO_HOOKS__&&window.__OMNICIAN_AUDIO_HOOKS__.onAppBackgrounded&&window.__OMNICIAN_AUDIO_HOOKS__.onAppBackgrounded()"
        (window?.rootViewController as? CAPBridgeViewController)?.webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}
