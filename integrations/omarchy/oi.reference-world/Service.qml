import QtQuick
import Quickshell
import Quickshell.Io

Item {
  id: root

  property var shell: null
  property bool available: false
  property string schema: ""
  property string worldLabel: "O:I"
  property string machineLabel: ""
  property string workcellHealth: ""
  property int presentProducts: 0
  property bool maximalContext: false
  property string errorText: ""
  property var currentWorld: null

  function refresh() {
    if (!worldProc.running) worldProc.running = true
  }

  function applyWorld(raw) {
    try {
      var value = JSON.parse(raw)
      if (!value || value.schema !== "oi.current-world/v1")
        throw new Error("unsupported current-world schema")
      root.currentWorld = value
      root.schema = value.schema
      root.available = true
      root.errorText = ""
      var frame = value.context_frame || {}
      var positions = frame.present_positions || []
      root.presentProducts = positions.length
      root.maximalContext = frame.maximal === true
      root.worldLabel = root.maximalContext ? "O:I · CF5" : "O:I · " + root.presentProducts + "/6"
      var machine = value.current_machine || null
      root.machineLabel = machine ? String(machine.role || "current") : ""
      root.workcellHealth = machine && machine.health ? String(machine.health) : ""
    } catch (error) {
      root.available = false
      root.currentWorld = null
      root.errorText = String(error)
      root.worldLabel = "O:I · unavailable"
      root.machineLabel = ""
      root.workcellHealth = ""
      root.presentProducts = 0
      root.maximalContext = false
    }
  }

  function markUnavailable(reason) {
    root.available = false
    root.currentWorld = null
    root.errorText = reason
    root.worldLabel = "O:I · unavailable"
    root.machineLabel = ""
    root.workcellHealth = ""
    root.presentProducts = 0
    root.maximalContext = false
  }

  Component.onCompleted: refresh()

  Timer {
    interval: 5000
    running: true
    repeat: true
    onTriggered: root.refresh()
  }

  Process {
    id: worldProc
    running: false
    command: ["oi", "current-world", "--json"]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyWorld(text)
    }
    onExited: function(exitCode) {
      if (exitCode !== 0) root.markUnavailable("oi current-world exited " + exitCode)
    }
  }
}
