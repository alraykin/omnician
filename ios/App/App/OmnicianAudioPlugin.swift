import AVFoundation
import Capacitor
import Foundation
import MediaPlayer
import UIKit

/// Native AVAudioSession, Now Playing, and licensed-sample decode.
/// Click/Drums still play through WKWebView Web Audio.
///
/// `.playback` (mixWithOthers off) while Click/Drums run so we are the Now
/// Playing app. `.playAndRecord` only while the tuner mic is live.
/// JS sets MediaMetadata title "Omnician" so WebKit does not publish the
/// webview origin ("localhost").
@objc(OmnicianAudioPlugin)
public class OmnicianAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmnicianAudioPlugin"
    public let jsName = "OmnicianAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearNowPlaying", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decodeSample", returnType: CAPPluginReturnPromise)
    ]

    private static weak var shared: OmnicianAudioPlugin?
    private static var observersReady = false
    private static var remotesReady = false
    private static var playAndRecord = false
    private static var nowPlayingActive = false

    public override func load() {
        Self.shared = self
        Self.activatePlayback()
        Self.installRemoteCommands()
    }

    @objc public static func activatePlayback() {
        do {
            try activate(playAndRecord: playAndRecord)
        } catch {
            NSLog("OmnicianAudio: %@", error.localizedDescription)
        }
        installSessionObservers()
    }

    @objc func setSession(_ call: CAPPluginCall) {
        let name = call.getString("category") ?? "playback"
        let panr = name == "playAndRecord" || name == "play-and-record"
        do {
            try Self.activate(playAndRecord: panr)
            call.resolve(Self.sessionSnapshot())
        } catch {
            call.reject("Failed to set AVAudioSession", nil, error)
        }
    }

    @objc func getSession(_ call: CAPPluginCall) {
        call.resolve(Self.sessionSnapshot())
    }

    @objc func setNowPlaying(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? "Omnician"
        let subtitle = call.getString("subtitle") ?? ""
        let playing = call.getBool("playing") ?? true
        Self.publishNowPlaying(title: title, subtitle: subtitle, playing: playing)
        call.resolve(["ok": true])
    }

    @objc func clearNowPlaying(_ call: CAPPluginCall) {
        Self.clearNowPlaying()
        call.resolve(["ok": true])
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
    static func activate(playAndRecord panr: Bool) throws {
        playAndRecord = panr
        let session = AVAudioSession.sharedInstance()
        if panr {
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.defaultToSpeaker, .allowBluetoothA2DP]
            )
        } else {
            try session.setCategory(.playback, mode: .default, options: [])
        }
        try session.setActive(true)
    }

    static func publishNowPlaying(title: String, subtitle: String, playing: Bool) {
        let apply = {
            nowPlayingActive = true
            UIApplication.shared.beginReceivingRemoteControlEvents()
            installRemoteCommands()
            var info: [String: Any] = [
                MPMediaItemPropertyTitle: title,
                MPMediaItemPropertyArtist: subtitle,
                MPMediaItemPropertyAlbumTitle: "Omnician",
                MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0,
                MPNowPlayingInfoPropertyMediaType: MPNowPlayingInfoMediaType.audio.rawValue,
                MPNowPlayingInfoPropertyIsLiveStream: true,
            ]
            if let image = artworkImage() {
                info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            NSLog("OmnicianAudio: nowPlaying title=%@", title)
        }
        if Thread.isMainThread { apply() } else { DispatchQueue.main.async(execute: apply) }
    }

    @objc public static func clearNowPlaying() {
        let apply = {
            nowPlayingActive = false
            let center = MPNowPlayingInfoCenter.default()
            if var info = center.nowPlayingInfo {
                info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
                center.nowPlayingInfo = info
            }
            if #available(iOS 13.0, *) {
                center.playbackState = .stopped
            }
            center.nowPlayingInfo = nil
            NSLog("OmnicianAudio: nowPlaying=nil")
        }
        if Thread.isMainThread { apply() } else { DispatchQueue.main.async(execute: apply) }
    }

    static func sessionSnapshot() -> [String: Any] {
        let session = AVAudioSession.sharedInstance()
        return [
            "category": shortCategory(session.category),
            "options": optionNames(session.categoryOptions),
            "otherAudioPlaying": session.isOtherAudioPlaying,
            "nowPlaying": nowPlayingActive,
        ]
    }

    private static func shortCategory(_ category: AVAudioSession.Category) -> String {
        switch category {
        case .playAndRecord: return "playAndRecord"
        case .playback: return "playback"
        case .ambient: return "ambient"
        case .soloAmbient: return "soloAmbient"
        case .record: return "record"
        case .multiRoute: return "multiRoute"
        default: return category.rawValue
        }
    }

    private static func optionNames(_ options: AVAudioSession.CategoryOptions) -> String {
        var names: [String] = []
        if options.contains(.mixWithOthers) { names.append("mixWithOthers") }
        if options.contains(.defaultToSpeaker) { names.append("defaultToSpeaker") }
        if options.contains(.allowBluetoothA2DP) { names.append("allowBluetoothA2DP") }
        if options.contains(.duckOthers) { names.append("duckOthers") }
        return names.isEmpty ? "none" : names.joined(separator: ",")
    }

    private static func artworkImage() -> UIImage? {
        let bundle = Bundle.main
        let paths = [
            ("omnician-icon-512", "public/brand"),
            ("omnician-icon-512", "brand"),
            ("AppIcon-512@2x", nil),
        ]
        for (name, sub) in paths {
            if let url = bundle.url(forResource: name, withExtension: "png", subdirectory: sub),
               let data = try? Data(contentsOf: url),
               let image = UIImage(data: data) {
                return image
            }
        }
        return UIImage(named: "AppIcon")
    }

    private static func installRemoteCommands() {
        let remote = MPRemoteCommandCenter.shared()
        remote.nextTrackCommand.isEnabled = false
        remote.previousTrackCommand.isEnabled = false
        remote.skipForwardCommand.isEnabled = false
        remote.skipBackwardCommand.isEnabled = false
        remote.changePlaybackPositionCommand.isEnabled = false
        remote.nextTrackCommand.removeTarget(nil)
        remote.previousTrackCommand.removeTarget(nil)
        remote.skipForwardCommand.removeTarget(nil)
        remote.skipBackwardCommand.removeTarget(nil)
        remote.changePlaybackPositionCommand.removeTarget(nil)

        if remotesReady { return }
        remotesReady = true
        remote.playCommand.isEnabled = true
        remote.pauseCommand.isEnabled = true
        remote.togglePlayPauseCommand.isEnabled = true
        remote.stopCommand.isEnabled = true
        remote.playCommand.addTarget { _ in
            emitRemote("play")
            return .success
        }
        remote.pauseCommand.addTarget { _ in
            emitRemote("pause")
            return .success
        }
        remote.togglePlayPauseCommand.addTarget { _ in
            emitRemote("toggle")
            return .success
        }
        remote.stopCommand.addTarget { _ in
            emitRemote("stop")
            return .success
        }
    }

    private static func emitRemote(_ action: String) {
        shared?.notifyListeners("remote", data: ["action": action])
    }

    private static func installSessionObservers() {
        if observersReady { return }
        observersReady = true
        let session = AVAudioSession.sharedInstance()
        let nc = NotificationCenter.default
        nc.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: .main) { note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            if raw == AVAudioSession.InterruptionType.ended.rawValue {
                activatePlayback()
            }
        }
        nc.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: .main) { _ in
            activatePlayback()
        }
        nc.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { _ in
            activatePlayback()
        }
        nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            activatePlayback()
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
