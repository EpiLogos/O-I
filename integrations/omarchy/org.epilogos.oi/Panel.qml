import QtQuick
import Quickshell.Wayland
import qs.Commons

Item {
  id: root

  property var shell: null
  property var manifest: null
  property var service: null
  property bool opened: false

  function open(payloadJson) {
    if (root.service && typeof root.service.refresh === "function") root.service.refresh()
    root.opened = true
    Qt.callLater(function() { if (root.opened) keyCatcher.forceActiveFocus() })
  }

  function close() { root.opened = false }

  function dismiss() {
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide((root.manifest && root.manifest.id) || "org.epilogos.oi")
    else close()
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"

    Rectangle {
      anchors.fill: parent
      color: Qt.rgba(0, 0, 0, 0.54)

      MouseArea {
        anchors.fill: parent
        onClicked: root.dismiss()
      }

      Rectangle {
        id: card
        width: Math.min(parent.width - 48, 720)
        height: Math.min(parent.height - 96, 620)
        anchors.centerIn: parent
        radius: 18
        color: "#171717"
        border.width: 1
        border.color: "#343434"

        MouseArea { anchors.fill: parent }

        Column {
          anchors.fill: parent
          anchors.margins: 28
          spacing: 16

          Text {
            text: "O:I · current World"
            color: "white"
            font.pixelSize: 24
            font.bold: true
          }

          Text {
            text: root.service && root.service.lastError
              ? root.service.lastError
              : "Ambient host projection over canonical O:I state. Quickshell owns presentation, not World or session identity."
            color: "#b8b8b8"
            font.pixelSize: 14
            wrapMode: Text.Wrap
            width: parent.width
          }

          Rectangle { width: parent.width; height: 1; color: "#343434" }

          Text {
            width: parent.width
            height: Math.max(120, parent.height - 150)
            text: root.service && root.service.snapshotJson
              ? root.service.snapshotJson
              : "No current-world reading yet."
            color: "#e7e7e7"
            font.family: "monospace"
            font.pixelSize: 12
            wrapMode: Text.WrapAnywhere
            elide: Text.ElideRight
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
