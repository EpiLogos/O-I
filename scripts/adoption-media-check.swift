// Explicit local acceptance only; never called from setup/installation.
// Keeps microphone samples in memory for two seconds, retaining only a peak.
import Foundation
import AVFoundation

let microphone = CommandLine.arguments.contains("--microphone")
let audioOutput = CommandLine.arguments.contains("--audio-output")
var report: [String: Any] = ["schema": "oi.adoption-mac-media/v1", "microphone": "not-requested", "audio_output": "not-requested", "physical_audibility": "requires-human-observation"]
var passed = true
if microphone {
    var permitted = false
    var replied = false
    AVCaptureDevice.requestAccess(for: .audio) { allowed in
        DispatchQueue.main.async { permitted = allowed; replied = true }
    }
    let permissionDeadline = Date().addingTimeInterval(30)
    while !replied && Date() < permissionDeadline { RunLoop.current.run(until: Date().addingTimeInterval(0.05)) }
    if !permitted {
        report["microphone"] = "permission-denied-or-timeout"
        passed = false
    } else {
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        let lock = NSLock()
        var frames: UInt64 = 0
        var peak: Float = 0
        if format.channelCount == 0 || format.sampleRate == 0 {
            report["microphone"] = "no-native-input-format"
            passed = false
        } else {
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                guard let data = buffer.floatChannelData else { return }
                var localPeak: Float = 0
                for i in 0..<Int(buffer.frameLength) { localPeak = max(localPeak, abs(data[0][i])) }
                lock.lock(); frames += UInt64(buffer.frameLength); peak = max(peak, localPeak); lock.unlock()
            }
            do {
                try engine.start()
                RunLoop.current.run(until: Date().addingTimeInterval(2))
                engine.stop(); input.removeTap(onBus: 0)
                lock.lock(); let count = frames; let observedPeak = peak; lock.unlock()
                report["microphone"] = ["frames": count, "peak": observedPeak, "sample_rate": format.sampleRate, "raw_audio_retained": false]
                if count == 0 || observedPeak == 0 { passed = false }
            } catch {
                input.removeTap(onBus: 0)
                report["microphone"] = "native-engine-failed"
                passed = false
            }
        }
    }
}
if audioOutput {
    let engine = AVAudioEngine()
    let player = AVAudioPlayerNode()
    let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
    let count: AVAudioFrameCount = 8820
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: count)!
    buffer.frameLength = count
    for i in 0..<Int(count) { buffer.floatChannelData![0][i] = 0.05 * sin(2 * .pi * 440 * Float(i) / 44100) }
    engine.attach(player); engine.connect(player, to: engine.mainMixerNode, format: format)
    do {
        try engine.start(); player.scheduleBuffer(buffer); player.play()
        RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        player.stop(); engine.stop()
        report["audio_output"] = "native-engine-played-quiet-200ms-tone"
    } catch { report["audio_output"] = "native-engine-failed"; passed = false }
}
report["passed"] = passed
let data = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
exit(passed ? 0 : 1)
