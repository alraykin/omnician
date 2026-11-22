import AVFoundation
import Capacitor
import Foundation
import MediaPlayer
import UIKit

/// Native AVAudioSession + licensed-sample decode. This plugin does not play
/// drums, clicks, or fork tones — WKWebView Web Audio does.
///
/// Category is always `.playAndRecord` with mixWithOthers / defaultToSpeaker /
/// allowBluetoothA2DP. `.playback` (exclusive media) plus a looping silent
/// `<audio>` in the Capacitor webview is what published a Now Playing widget
/// titled "localhost" after `registerPluginInstance` made this plugin live.
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
            try activate()
        } catch {
            NSLog("OmnicianAudio: %@", error.localizedDescription)
        }
    }

    @objc func setSession(_ call: CAPPluginCall) {
        do {
            try Self.activate()
            call.resolve(["category": "playAndRecord"])
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
    static func activate() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP]
        )
        try session.setActive(true)
        suppressNowPlaying()
    }

    /// Never publish lock-screen / Dynamic Island transport for Web Audio.
    static func suppressNowPlaying() {
        let apply = {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
            UIApplication.shared.endReceivingRemoteControlEvents()
            let remote = MPRemoteCommandCenter.shared()
            let commands: [MPRemoteCommand] = [
                remote.playCommand,
                remote.pauseCommand,
                remote.stopCommand,
                remote.togglePlayPauseCommand,
                remote.nextTrackCommand,
                remote.previousTrackCommand,
                remote.skipForwardCommand,
                remote.skipBackwardCommand,
                remote.changePlaybackPositionCommand,
            ]
            for command in commands {
                command.isEnabled = false
                command.removeTarget(nil)
            }
        }
        if Thread.isMainThread {
            apply()
        } else {
            DispatchQueue.main.async(execute: apply)
        }
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
