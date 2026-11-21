import Capacitor
import UIKit

/// Fills the window on fold/unfold and rotation so Duo layouts see the real viewport.
class OmnicianBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        edgesForExtendedLayout = .all
        view.insetsLayoutMarginsFromSafeArea = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.contentInset = .zero
        webView?.scrollView.scrollIndicatorInsets = .zero
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        webView?.frame = view.bounds
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate { _ in
            self.webView?.frame = CGRect(origin: .zero, size: size)
        } completion: { _ in
            self.webView?.frame = self.view.bounds
            self.notifyPageSizeChanged()
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
