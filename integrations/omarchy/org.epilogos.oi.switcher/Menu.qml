import QtQuick
import Quickshell.Wayland
import Quickshell.Io

Item {
  id: root

  property var shell: null
  property var manifest: null
  property bool opened: false
  property string bimbaStatusJson: ""
  property string bimbaError: ""
  property bool bimbaBusy: false
  property var bimbaStatus: {
    try { return bimbaStatusJson.length > 0 ? JSON.parse(bimbaStatusJson) : ({}) }
    catch (error) { return ({}) }
  }
  property bool bimbaSelected: bimbaStatus.selected === true
  property bool bimbaActive: bimbaStatus.active === true

  function open(payloadJson) {
    root.opened = true
    root.refreshBimba()
    Qt.callLater(function() { if (root.opened) keyCatcher.forceActiveFocus() })
  }

  function close() { root.opened = false }

  function dismiss() {
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "org.epilogos.oi.switcher")
    else close()
  }

  function openCurrentWorld() {
    if (root.shell && typeof root.shell.toggle === "function") {
      root.dismiss()
      root.shell.toggle("org.epilogos.oi", "{}")
    }
  }

  function refreshBimba() {
    if (bimbaStatusProcess.running || bimbaActionProcess.running) return
    root.bimbaBusy = true
    root.bimbaError = ""
    bimbaStatusCollector.text = ""
    bimbaStatusProcess.running = true
  }

  function toggleBimba() {
    if (root.bimbaBusy) return
    root.bimbaBusy = true
    root.bimbaError = ""
    bimbaActionCollector.text = ""
    bimbaActionProcess.command = ["oi", "bimba-map", root.bimbaSelected ? "deselect" : "select", "--json"]
    bimbaActionProcess.running = true
  }

  Process {
    id: bimbaStatusProcess
    running: false
    command: ["oi", "bimba-map", "status", "--json"]
    stdout: StdioCollector {
      id: bimbaStatusCollector
      waitForEnd: true
      onStreamFinished: root.bimbaStatusJson = text
    }
    stderr: StdioCollector {
      id: bimbaStatusErrorCollector
      waitForEnd: true
    }
    onExited: function(exitCode) {
      root.bimbaBusy = false
      if (exitCode !== 0) root.bimbaError = bimbaStatusErrorCollector.text || "Could not read Bimba map status"
    }
  }

  Process {
    id: bimbaActionProcess
    running: false
    command: []
    stdout: StdioCollector {
      id: bimbaActionCollector
      waitForEnd: true
      onStreamFinished: root.bimbaStatusJson = text
    }
    stderr: StdioCollector {
      id: bimbaActionErrorCollector
      waitForEnd: true
    }
    onExited: function(exitCode) {
      root.bimbaBusy = false
      if (exitCode !== 0) root.bimbaError = bimbaActionErrorCollector.text || "Bimba map selection could not be changed"
      root.refreshBimba()
    }
  }

  PanelWindow {
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"

    Rectangle {
      anchors.fill: parent
      color: Qt.rgba(0, 0, 0, 0.6)

      MouseArea { anchors.fill: parent; onClicked: root.dismiss() }

      Rectangle {
        width: Math.min(parent.width - 48, 440)
        height: 350
        anchors.centerIn: parent
        radius: 18
        color: "#171717"
        border.width: 1
        border.color: "#343434"

        MouseArea { anchors.fill: parent }

        Column {
          anchors.fill: parent
          anchors.margins: 24
          spacing: 14

          Text {
            text: "O:I switcher"
            color: "white"
            font.pixelSize: 22
            font.bold: true
          }

          Text {
            width: parent.width
            text: "Native Omarchy entry point into canonical O:I Surfaces. This menu owns no World, Project, AgentSession or Activity state."
            color: "#b8b8b8"
            font.pixelSize: 13
            wrapMode: Text.Wrap
          }

          Rectangle {
            width: parent.width
            height: 52
            radius: 10
            color: worldArea.containsMouse ? "#333333" : "#262626"
            border.width: 1
            border.color: "#444444"

            Text {
              anchors.centerIn: parent
              text: "Current World / Agency / Attention"
              color: "white"
              font.pixelSize: 14
            }

            MouseArea {
              id: worldArea
              anchors.fill: parent
              hoverEnabled: true
              onClicked: root.openCurrentWorld()
            }
          }

          Rectangle {
            width: parent.width
            height: 74
            radius: 10
            color: bimbaArea.containsMouse ? "#333333" : "#262626"
            border.width: 1
            border.color: root.bimbaActive ? "#3f8f62" : "#444444"

            Column {
              anchors.verticalCenter: parent.verticalCenter
              anchors.left: parent.left
              anchors.right: parent.right
              anchors.margins: 14
              spacing: 4
              Text {
                text: root.bimbaBusy ? "Bimba map · checking…" : (root.bimbaActive ? "Bimba map · active" : (root.bimbaSelected ? "Bimba map · selected, unavailable" : "Bimba map · off"))
                color: "white"
                font.pixelSize: 14
              }
              Text {
                text: root.bimbaActive ? "Click to remove it from native harnesses" : "Click to health-check and project via AIKit"
                color: "#b8b8b8"
                font.pixelSize: 12
              }
            }

            MouseArea {
              id: bimbaArea
              anchors.fill: parent
              hoverEnabled: true
              onClicked: root.toggleBimba()
            }
          }

          Text {
            visible: root.bimbaError.length > 0
            width: parent.width
            text: root.bimbaError
            color: "#ef8b8b"
            font.pixelSize: 11
            wrapMode: Text.Wrap
          }
        }
      }

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true
        Keys.onEscapePressed: root.dismiss()
      }
    }
  }
}
