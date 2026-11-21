import Capacitor
import CoreMotion
import UIKit

/// Reports Duo hinge / display / gravity to JS. Safari never loads this plugin.
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
    private let motionQueue = OperationQueue()
    private var hingeAvailable = false
    private var hingeStatus: String?
    private var hingeAngleDeg: Double?
    private var foldDivisionActive: NSNumber?
    private var foldDivisionHorizontal: NSNumber?
    private var gravity: (x: Double, y: Double, z: Double)?
    private var motionAvailable = false
    private var lastKey = ""
    private var hingeAttached = false

    public override func load() {
        Self.shared = self
        motionQueue.name = "app.omnician.posture"
        motionQueue.maxConcurrentOperationCount = 1
        startObservers()
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(payload())
    }

    @objc func start(_ call: CAPPluginCall) {
        startObservers()
        attachHingeToBridgeIfNeeded()
        call.resolve(payload())
    }

    @objc func stop(_ call: CAPPluginCall) {
        motion.stopDeviceMotionUpdates()
        call.resolve()
    }

    func noteWindowLayout(size: CGSize, view: UIView?) {
        readDivision(from: view)
        publish()
    }

    func attachHinge(to view: UIView) {
        if hingeAttached { return }
        hingeAttached = true
        // Xcode 26.6 = Swift 6.3 / iOS 26.5 SDK: no UIHingeInteraction.
        // Xcode 27.2 = Swift 6.4 / iOS 27.2 SDK: hinge + crease APIs exist.
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            attachHingeInteraction(to: view)
        }
        #endif
        readDivision(from: view)
        publish()
    }

    private func startObservers() {
        attachHingeToBridgeIfNeeded()
        startMotion()
        NotificationCenter.default.removeObserver(self)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onOrientation),
            name: UIDevice.orientationDidChangeNotification,
            object: nil
        )
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        publish()
    }

    private func attachHingeToBridgeIfNeeded() {
        guard let view = bridge?.viewController?.view else { return }
        attachHinge(to: view)
    }

    @objc private func onOrientation() {
        publish()
    }

    private func startMotion() {
        guard motion.isDeviceMotionAvailable else {
            motionAvailable = false
            return
        }
        motionAvailable = true
        motion.deviceMotionUpdateInterval = 0.12
        motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: motionQueue) { [weak self] data, _ in
            guard let self, let g = data?.gravity else { return }
            self.gravity = (g.x, g.y, g.z)
            DispatchQueue.main.async { self.publish() }
        }
    }

#if compiler(>=6.4)
    @available(iOS 27.1, *)
    private func attachHingeInteraction(to view: UIView) {
        // Real SDK: init(updateHandler:) → ObjC initWithUpdateHandler:. There is no bare init.
        let interaction = UIHingeInteraction { [weak self] (_: UIHingeInteraction, update: UIHingeInteraction.Update) in
            guard let self else { return }
            guard let hinge = update.hinge else {
                self.hingeAvailable = false
                self.hingeStatus = nil
                self.hingeAngleDeg = nil
                self.publish()
                return
            }
            self.hingeAvailable = true
            self.hingeAngleDeg = Double(hinge.angle) * 180.0 / .pi
            switch hinge.status {
            case .closed:
                self.hingeStatus = "closed"
            case .partiallyOpen:
                self.hingeStatus = "partiallyOpen"
            case .fullyOpen:
                self.hingeStatus = "fullyOpen"
            case .unknown:
                self.hingeStatus = "unknown"
            @unknown default:
                self.hingeStatus = "unknown"
            }
            self.publish()
        }
        view.addInteraction(interaction)
    }
#endif

    private func readDivision(from view: UIView?) {
        guard let view else { return }
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            readDivisionRegions(from: view)
        }
        #endif
    }

#if compiler(>=6.4)
    @available(iOS 27.1, *)
    private func readDivisionRegions(from view: UIView) {
        // Real SDK: reservedRegions(kind:options:). Kind is UIView.ReservedRegion.Kind
        // (ObjC UIViewReservedRegionKind object), not a C enum.
        let regions = view.reservedRegions(kind: .division, options: [])
        if let region = regions.first, region.isActive {
            let frame = region.frame
            foldDivisionActive = true
            foldDivisionHorizontal = NSNumber(value: frame.width > frame.height)
            return
        }
        foldDivisionActive = false
        foldDivisionHorizontal = nil
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
        } else if shortest >= 640 {
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
}
