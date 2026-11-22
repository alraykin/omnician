import Capacitor
import CoreMotion
import UIKit

/// Reports Duo hinge / display / gravity to JS. Safari never loads this plugin.
///
/// Hinge and crease APIs must not run until the bridge view is in a window.
/// UIHingeInteraction / reservedRegions crash on iOS 27 if attached too early
/// (plugin `load()` / `viewDidLoad`) or if the update handler touches UIKit
/// off the main thread. Every failure here is swallowed; window size + gravity
/// still work.
@objc(OmnicianPosturePlugin)
public class OmnicianPosturePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmnicianPosturePlugin"
    public let jsName = "OmnicianPosture"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    static weak var shared: OmnicianPosturePlugin?

    private let motion = CMMotionManager()
    private var hingeAvailable = false
    private var hingeStatus: String?
    private var hingeAngleDeg: Double?
    private var foldDivisionActive: NSNumber?
    private var foldDivisionHorizontal: NSNumber?
    private var gravity: (x: Double, y: Double, z: Double)?
    private var motionAvailable = false
    private var lastKey = ""
    private var orientationStarted = false
    private var motionStarted = false
    private var hingeAttachFailed = false
    private var divisionReadFailed = false
    private var windowReady = false
    private var hingeInteraction: UIInteraction?
    private weak var hingeView: UIView?

    public override func load() {
        Self.shared = self
        // Do not attach hinge, read reserved regions, or start motion here.
        // Capacitor calls load() from CAPBridgeViewController.viewDidLoad,
        // before `view.window` exists. That is what crashed TestFlight on Duo.
    }

    @objc func getState(_ call: CAPPluginCall) {
        onMain {
            call.resolve(self.payload())
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        onMain {
            self.activate(on: nil)
            call.resolve(self.payload())
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        onMain {
            self.motion.stopDeviceMotionUpdates()
            self.motionStarted = false
            if let interaction = self.hingeInteraction, let view = self.hingeView {
                _ = OmnicianSafeCall.run {
                    view.removeInteraction(interaction)
                }
            }
            self.hingeInteraction = nil
            self.hingeView = nil
            call.resolve()
        }
    }

    func attachWhenWindowReady(to view: UIView) {
        onMain {
            self.activate(on: view)
        }
    }

    func noteWindowLayout(size: CGSize, view: UIView?) {
        onMain {
            guard self.windowReady, let view, view.window != nil else { return }
            self.readDivisionSafely(from: view)
            self.publish()
            _ = size
        }
    }

    private func activate(on view: UIView?) {
        let host = view ?? bridge?.viewController?.view
        guard let host, host.window != nil else { return }
        windowReady = true
        startMotionIfNeeded()
        startOrientationIfNeeded()
        attachHingeIfNeeded(to: host)
        readDivisionSafely(from: host)
        publish()
    }

    private func startOrientationIfNeeded() {
        guard !orientationStarted else { return }
        orientationStarted = true
        NotificationCenter.default.removeObserver(self)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onOrientation),
            name: UIDevice.orientationDidChangeNotification,
            object: nil
        )
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
    }

    @objc private func onOrientation() {
        onMain { self.publish() }
    }

    private func startMotionIfNeeded() {
        guard !motionStarted else { return }
        guard motion.isDeviceMotionAvailable else {
            motionAvailable = false
            return
        }
        motionStarted = true
        motionAvailable = true
        motion.deviceMotionUpdateInterval = 0.12
        // Deliver on main so Swift 6.4 / UIKit isolation cannot trap.
        motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] data, _ in
            guard let self, let g = data?.gravity else { return }
            self.gravity = (g.x, g.y, g.z)
            self.publish()
        }
    }

    private func attachHingeIfNeeded(to view: UIView) {
        guard hingeInteraction == nil, !hingeAttachFailed else { return }
        guard view.window != nil else { return }
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            attachHingeInteraction(to: view)
        }
        #endif
    }

#if compiler(>=6.4)
    @available(iOS 27.1, *)
    private func attachHingeInteraction(to view: UIView) {
        // Real SDK: init(updateHandler:) → ObjC initWithUpdateHandler:.
        var created: UIHingeInteraction?
        let ok = OmnicianSafeCall.run {
            let interaction = UIHingeInteraction { [weak self] (_: UIHingeInteraction, update: UIHingeInteraction.Update) in
                // Read the update before returning; hop to main to touch plugin state / UIKit.
                var available = false
                var status: String?
                var angle: Double?
                let extracted = OmnicianSafeCall.run {
                    guard let hinge = update.hinge else { return }
                    available = true
                    angle = Double(hinge.angle) * 180.0 / .pi
                    switch hinge.status {
                    case .closed:
                        status = "closed"
                    case .partiallyOpen:
                        status = "partiallyOpen"
                    case .fullyOpen:
                        status = "fullyOpen"
                    case .unknown:
                        status = "unknown"
                    @unknown default:
                        status = "unknown"
                    }
                }
                guard extracted else { return }
                DispatchQueue.main.async {
                    self?.applyHingeSnapshot(available: available, status: status, angle: angle)
                }
            }
            view.addInteraction(interaction)
            created = interaction
        }
        if ok, let created {
            hingeInteraction = created
            hingeView = view
        } else {
            hingeAttachFailed = true
            hingeInteraction = nil
            NSLog("OmnicianPosture: UIHingeInteraction attach failed; using size+gravity")
        }
    }
#endif

    private func applyHingeSnapshot(available: Bool, status: String?, angle: Double?) {
        hingeAvailable = available
        hingeStatus = status
        hingeAngleDeg = angle
        publish()
    }

    private func readDivisionSafely(from view: UIView) {
        guard !divisionReadFailed else { return }
        guard view.window != nil else { return }
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            readDivisionRegions(from: view)
        }
        #endif
    }

#if compiler(>=6.4)
    @available(iOS 27.1, *)
    private func readDivisionRegions(from view: UIView) {
        var active = false
        var horizontal: NSNumber?
        let ok = OmnicianSafeCall.run {
            // Real SDK: reservedRegions(kind:options:). Kind is UIView.ReservedRegion.Kind
            // (ObjC UIViewReservedRegionKind object), not a C enum.
            let regions = view.reservedRegions(kind: .division, options: [])
            if let region = regions.first, region.isActive {
                let frame = region.frame
                active = true
                horizontal = NSNumber(value: frame.width > frame.height)
            }
        }
        if ok {
            foldDivisionActive = NSNumber(value: active)
            foldDivisionHorizontal = horizontal
        } else {
            divisionReadFailed = true
            foldDivisionActive = nil
            foldDivisionHorizontal = nil
            NSLog("OmnicianPosture: reservedRegions failed; using size+gravity")
        }
    }
#endif

    private func windowSize() -> CGSize {
        if let bounds = bridge?.viewController?.view.bounds, bounds.width > 0 {
            return bounds.size
        }
        return .zero
    }

    private func payload() -> [String: Any] {
        let size = windowSize()
        let shortest = min(size.width, size.height)
        let display: String
        if shortest <= 0 {
            display = "unknown"
        } else if shortest >= 600 {
            display = "inner"
        } else {
            display = "outer"
        }
        let orientation = size.width >= size.height && size.width > 0 ? "landscape" : "portrait"
        var source = "size"
        if hingeAvailable { source = "hinge" }
        else if foldDivisionActive?.boolValue == true { source = "division" }
        else if motionAvailable { source = "motion" }
        var data: [String: Any] = [
            "hingeAvailable": hingeAvailable,
            "display": display,
            "orientation": orientation,
            "windowWidth": Double(size.width),
            "windowHeight": Double(size.height),
            "motionAvailable": motionAvailable,
            "source": source,
        ]
        if let hingeStatus { data["hingeStatus"] = hingeStatus }
        if let hingeAngleDeg { data["hingeAngleDeg"] = hingeAngleDeg }
        if let foldDivisionActive { data["foldDivisionActive"] = foldDivisionActive }
        if let foldDivisionHorizontal { data["foldDivisionHorizontal"] = foldDivisionHorizontal }
        if let gravity {
            data["gravityX"] = gravity.x
            data["gravityY"] = gravity.y
            data["gravityZ"] = gravity.z
        }
        return data
    }

    private func publish() {
        let data = payload()
        let angleBucket = Int(((data["hingeAngleDeg"] as? Double) ?? -1) / 2)
        let gx = Int(((data["gravityX"] as? Double) ?? 0) * 10)
        let gy = Int(((data["gravityY"] as? Double) ?? 0) * 10)
        let gz = Int(((data["gravityZ"] as? Double) ?? 0) * 10)
        let key = "\(data["display"] ?? "")|\(data["orientation"] ?? "")|\(data["hingeStatus"] ?? "")|\(angleBucket)|\(data["foldDivisionActive"] ?? "")|\(gx),\(gy),\(gz)"
        guard key != lastKey else { return }
        lastKey = key
        notifyListeners("postureChange", data: data)
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }
}
