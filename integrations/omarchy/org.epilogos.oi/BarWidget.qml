import QtQuick
import qs.Ui

BarWidget {
  id: root
  moduleName: "org.epilogos.oi"

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "O:I"
    horizontalMargin: 7.5
    onPressed: function(button) {
      if (!root.bar) return
      if (button === Qt.RightButton)
        root.bar.run("omarchy-shell shell toggle org.epilogos.oi.switcher '{}'")
      else
        root.bar.run("omarchy-shell shell toggle org.epilogos.oi '{}'")
    }
  }
}
