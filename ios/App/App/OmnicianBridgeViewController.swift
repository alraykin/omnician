import Capacitor
import UIKit
import WebKit

/// Fills the window on fold/unfold and rotation so Duo layouts see the real viewport.
class OmnicianBridgeViewController: CAPBridgeViewController {
    /// Local Swift plugins live in the App target and are not in Capacitor's
    /// packageClassList, so they are never auto-discovered. Register them here
    /// before the webview loads so PluginHeaders exist for JS `registerPlugin`.
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(OmnicianPosturePlugin())
        bridge?.registerPluginInstance(OmnicianAudioPlugin())
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsPictureInPictureMediaPlayback = false
        return config
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        edgesForExtendedLayout = .all
        view.insetsLayoutMarginsFromSafeArea = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.contentInset = .zero
        webView?.scrollView.scrollIndicatorInsets = .zero
        // Do not attach UIHingeInteraction here — `view.window` is still nil.
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        OmnicianPosturePlugin.shared?.attachWhenWindowReady(to: view)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.frame = view.bounds
        guard view.window != nil else { return }
        OmnicianPosturePlugin.shared?.noteWindowLayout(size: view.bounds.size, view: view)
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate { _ in
            self.webView?.frame = CGRect(origin: .zero, size: size)
        } completion: { _ in
            self.webView?.frame = self.view.bounds
            self.notifyPageSizeChanged()
            if self.view.window != nil {
                OmnicianPosturePlugin.shared?.noteWindowLayout(size: self.view.bounds.size, view: self.view)
            }
        }
    }

    private func notifyPageSizeChanged() {
        webView?.evaluateJavaScript(
            """
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('orientationchange'));
            if (window.visualViewport) {
              window.visualViewport.dispatchEvent(new Event('resize'));
            }
            """,
            completionHandler: nil
        )
    }
}
