import QtQuick
import Quickshell.Io

QtObject {
  id: root

  property var shell: null
  property var manifest: null
  property string snapshotJson: ""
  property string lastError: ""
  property bool refreshing: false

  function refresh() {
    if (readProcess.running) return "busy"
    root.refreshing = true
    root.lastError = ""
    collector.text = ""
    readProcess.command = ["oi", "current-world", "--json"]
    readProcess.running = true
    return "ok"
  }

  function ping() { return "ok" }

  property Process readProcess: Process {
    id: readProcess
    running: false
    command: []
    stdout: StdioCollector {
      id: collector
      waitForEnd: true
      onStreamFinished: root.snapshotJson = text
    }
    onExited: function(exitCode) {
      root.refreshing = false
      if (exitCode !== 0) root.lastError = "oi current-world exited " + exitCode
    }
  }

  Component.onCompleted: refresh()
}
