import QtQuick
import Quickshell
import qs.Commons
import qs.Ui

Panel {
  id: root
  moduleName: "oi.reference-world"
  ipcTarget: "oi.reference-world"
  manageIpc: false

  property var shell: null
  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root
  readonly property var bridge: shell ? shell.serviceFor("oi.reference-world") : (bar && bar.shell ? bar.shell.serviceFor("oi.reference-world") : null)
  readonly property string label: "O:I"
  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  function open() {
    root.controller.show()
    if (bridge && bridge.refresh) bridge.refresh()
  }

  function openFromHotkey() { open() }
  function close() { root.controller.hide() }
  function toggle() { root.opened ? close() : open() }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    contentWidth: panel.fittedContentWidth(Style.space(340))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    Column {
      id: content
      anchors.fill: parent
      spacing: Style.space(12)

      Text {
        text: bridge ? bridge.worldLabel : "O:I · unavailable"
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.subtitle
        font.bold: true
      }

      Text {
        width: parent.width
        wrapMode: Text.WordWrap
        text: bridge && bridge.available
          ? (bridge.maximalContext
              ? "The full six-product Context Frame is present in this World."
              : bridge.presentProducts + " of 6 O:I product positions are presently available.")
          : "The canonical O:I current-world reading is unavailable."
        color: root.foreground
        font.family: root.fontFamily
        font.pixelSize: Style.font.body
      }

      Text {
        width: parent.width
        visible: bridge && bridge.machineLabel !== ""
        text: "Machine · " + (bridge ? bridge.machineLabel : "")
          + (bridge && bridge.workcellHealth !== "" ? " · Workcell " + bridge.workcellHealth : "")
        color: Qt.darker(root.foreground, 1.25)
        font.family: root.fontFamily
        font.pixelSize: Style.font.bodySmall
      }

      Text {
        width: parent.width
        visible: bridge && !bridge.available && bridge.errorText !== ""
        wrapMode: Text.WordWrap
        text: bridge ? bridge.errorText : ""
        color: Qt.darker(root.foreground, 1.25)
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
      }

      Row {
        spacing: Style.space(8)

        Button {
          text: "Refresh"
          foreground: root.foreground
          onClicked: if (bridge && bridge.refresh) bridge.refresh()
        }

        Button {
          text: "Inspect"
          foreground: root.foreground
          onClicked: Quickshell.execDetached(["oi", "current-world"])
        }
      }
    }
  }
}
