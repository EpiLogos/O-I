// Read-only accessibility walk of one process's windows: prints every element
// whose value, title, description or help mentions the run context.
// It walks only elements whose role is AXWindow and never descends into an
// AXApplication element: when the host exposes no window (r1e: the app
// answered AXWindows with itself), the walk would otherwise loop through the
// application and its menu bar to the depth limit. The closing lines count
// windows, web areas (the webview's document) and elements, so a caller can
// tell an unpopulated or absent webview from a settled one.
import ApplicationServices
import Foundation

let args = CommandLine.arguments
guard args.count >= 2, let pid = pid_t(args[1]) else { print("usage: ax-run-context <pid> [needle...]"); exit(2) }
let needles = args.count > 2 ? Array(args[2...]) : ["Native host", "Development browser", "run context", "Reading run context"]
print("# AXIsProcessTrusted: \(AXIsProcessTrusted())")
let app = AXUIElementCreateApplication(pid)

func attr(_ e: AXUIElement, _ name: String) -> String {
    var v: CFTypeRef?
    guard AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success, let value = v else { return "" }
    if let s = value as? String { return s }
    return ""
}
func children(_ e: AXUIElement) -> [AXUIElement] {
    var v: CFTypeRef?
    guard AXUIElementCopyAttributeValue(e, kAXChildrenAttribute as CFString, &v) == .success, let list = v as? [AXUIElement] else { return [] }
    return list
}
var visited = 0
var webAreas = 0
func walk(_ e: AXUIElement, _ depth: Int) {
    visited += 1
    if depth > 60 { return }
    if attr(e, kAXRoleAttribute) == "AXWebArea" { webAreas += 1 }
    let fields = ["role": attr(e, kAXRoleAttribute), "value": attr(e, kAXValueAttribute), "title": attr(e, kAXTitleAttribute),
                  "description": attr(e, kAXDescriptionAttribute), "help": attr(e, kAXHelpAttribute)]
    let text = [fields["value"]!, fields["title"]!, fields["description"]!, fields["help"]!].joined(separator: " ")
    if needles.contains(where: { text.localizedCaseInsensitiveContains($0) }) {
        print("\(fields["role"]!) | value: \(fields["value"]!) | title: \(fields["title"]!) | description: \(fields["description"]!) | help: \(fields["help"]!)")
    }
    for c in children(e) where attr(c, kAXRoleAttribute) != "AXApplication" { walk(c, depth + 1) }
}
var windows: CFTypeRef?
AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windows)
var windowCount = 0
for w in (windows as? [AXUIElement]) ?? [] {
    let role = attr(w, kAXRoleAttribute)
    guard role == "AXWindow" else { print("# not a window (role \(role)): \(attr(w, kAXTitleAttribute))"); continue }
    windowCount += 1
    print("window: \(attr(w, kAXTitleAttribute))")
    walk(w, 0)
}
print("# windows: \(windowCount)")
print("# web areas: \(webAreas)")
print("# elements visited: \(visited)")
