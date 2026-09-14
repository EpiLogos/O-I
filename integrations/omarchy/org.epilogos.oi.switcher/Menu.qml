import QtQuick
import Quickshell.Wayland

Item {
  id: root

  property var shell: null
  property var manifest: null
  property bool opened: false

  function open(payloadJson) {
    root.opened = true
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
        height: 250
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
