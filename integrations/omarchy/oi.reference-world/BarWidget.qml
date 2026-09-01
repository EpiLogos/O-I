import QtQuick
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "oi.reference-world"

  readonly property var bridge: bar?.shell?.serviceFor("oi.reference-world")

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("shell" in target && root.bar) target.shell = root.bar.shell
  }

  function togglePanel() {
    if (panelLoader.item && panelLoader.item.toggle) panelLoader.item.toggle()
  }

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  function open() { if (panelLoader.item && panelLoader.item.openFromHotkey) panelLoader.item.openFromHotkey() }
  function close() { if (panelLoader.item && panelLoader.item.close) panelLoader.item.close() }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "󰘧"
    slotSize: Style.bar.statusSlot
    tooltipText: bridge ? bridge.worldLabel : "O:I"
    opacity: bridge && bridge.available ? 1.0 : 0.55

    onPressed: function(mouseButton) {
      if (mouseButton === Qt.MiddleButton) {
        if (root.bridge && root.bridge.refresh) root.bridge.refresh()
      } else {
        root.togglePanel()
      }
    }
  }
}
