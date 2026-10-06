// Before first paint: ?theme= > remembered > the operating system.
const pick = (() => {
  try {
    return new URLSearchParams(location.search).get("theme") || localStorage.getItem("theme")
  } catch {
    return null
  }
})()
const preferred = (() => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  } catch {
    return "light"
  }
})()
document.documentElement.setAttribute("saved-theme", pick === "dark" || pick === "light" ? pick : preferred)
