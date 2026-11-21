import AVFoundation
import Capacitor
import Foundation

/// Native AVAudioSession bridge so Click/Drums stay audible with the silent switch on.
/// mixWithOthers stays off. Playback uses empty options; tuner mic uses playAndRecord + defaultToSpeaker.
@objc(OmnicianAudioPlugin)
public class OmnicianAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmnicianAudioPlugin"
    public let jsName = "OmnicianAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        Self.activatePlayback()
    }

    @objc public static func activatePlayback() {
        do {
            try activate(category: .playback, playAndRecord: false)
        } catch {
            NSLog("OmnicianAudio: %@", error.localizedDescription)
        }
    }

    @objc func setSession(_ call: CAPPluginCall) {
        let name = call.getString("category") ?? "playback"
        let playAndRecord = name == "playAndRecord" || name == "play-and-record"
        let category: AVAudioSession.Category = playAndRecord ? .playAndRecord : .playback
        do {
            try Self.activate(category: category, playAndRecord: playAndRecord)
            call.resolve(["category": playAndRecord ? "playAndRecord" : "playback"])
        } catch {
            call.reject("Failed to set AVAudioSession", nil, error)
        }
    }

    @discardableResult
    static func activate(category: AVAudioSession.Category, playAndRecord: Bool) throws {
        let session = AVAudioSession.sharedInstance()
        // Empty options: mixWithOthers is off so this app owns the session.
        var options: AVAudioSession.CategoryOptions = []
        if playAndRecord {
            options.insert(.defaultToSpeaker)
        }
        try session.setCategory(category, mode: .default, options: options)
        try session.setActive(true)
    }
}
