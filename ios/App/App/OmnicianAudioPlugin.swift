import AVFoundation
import Capacitor
import Foundation

/// Native AVAudioSession bridge so Click/Drums stay audible with the silent switch on.
/// mixWithOthers stays off. Playback uses empty options; tuner mic uses playAndRecord + defaultToSpeaker.
///
/// This plugin does not play drums or clicks. WKWebView's decodeAudioData often fails on
/// AAC/m4a (and sometimes mp3) from the custom app scheme, which made RhythmKit fall
/// back to baked synth hits. `decodeSample` turns the same licensed bytes into PCM so
/// the shared JS KitEngine can play them.
@objc(OmnicianAudioPlugin)
public class OmnicianAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmnicianAudioPlugin"
    public let jsName = "OmnicianAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decodeSample", returnType: CAPPluginReturnPromise)
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

    @objc func decodeSample(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("missing base64")
            return
        }
        let ext = Self.safeExt(call.getString("ext"))
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let result = try Self.decodeBytes(base64: base64, ext: ext)
                DispatchQueue.main.async { call.resolve(result) }
            } catch {
                DispatchQueue.main.async {
                    call.reject("decode failed", nil, error)
                }
            }
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

    private static func safeExt(_ raw: String?) -> String {
        let trimmed = (raw ?? "m4a").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if trimmed == "m4a" || trimmed == "mp4" || trimmed == "aac" { return "m4a" }
        if trimmed == "mp3" { return "mp3" }
        if trimmed == "wav" || trimmed == "wave" { return "wav" }
        if trimmed == "aif" || trimmed == "aiff" { return "aiff" }
        if trimmed == "caf" { return "caf" }
        return "m4a"
    }

    private static func decodeBytes(base64: String, ext: String) throws -> [String: Any] {
        guard let data = Data(base64Encoded: base64) else {
            throw NSError(domain: "OmnicianAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "invalid base64"])
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("omnician-decode-\(UUID().uuidString).\(ext)")
        try data.write(to: url, options: .atomic)
        defer { try? FileManager.default.removeItem(at: url) }

        let file = try AVAudioFile(forReading: url)
        let format = file.processingFormat
        let frames = AVAudioFrameCount(file.length)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else {
            throw NSError(domain: "OmnicianAudio", code: 2, userInfo: [NSLocalizedDescriptionKey: "pcm buffer"])
        }
        try file.read(into: buffer)

        let channelCount = Int(format.channelCount)
        let frameLength = Int(buffer.frameLength)
        guard channelCount > 0, frameLength > 0, let channels = buffer.floatChannelData else {
            throw NSError(domain: "OmnicianAudio", code: 3, userInfo: [NSLocalizedDescriptionKey: "empty pcm"])
        }

        var interleaved = [Float](repeating: 0, count: frameLength * channelCount)
        for i in 0..<frameLength {
            for c in 0..<channelCount {
                interleaved[i * channelCount + c] = channels[c][i]
            }
        }
        let pcm = interleaved.withUnsafeBufferPointer { Data(buffer: $0) }
        return [
            "sampleRate": format.sampleRate,
            "numberOfChannels": channelCount,
            "length": frameLength,
            "pcmBase64": pcm.base64EncodedString()
        ]
    }
}
