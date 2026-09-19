/** Bring an element into view by scrolling ONLY its nearest scrolling
 * ancestor. `Element.scrollIntoView` scrolls every ancestor that can scroll —
 * including `overflow:hidden` ones — so from inside a pane it shifts the
 * shell itself: the whole app slides up and the footer row jams into view.
 * Regions own their scrolling; nothing may scroll the shell. */
export function scrollWithin(element: Element | null | undefined, block: "start" | "center" | "nearest" = "nearest"): void {
  if (!(element instanceof HTMLElement)) return;
  let scroller: HTMLElement | null = element.parentElement;
  while (scroller) {
    const overflow = getComputedStyle(scroller).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const box = element.getBoundingClientRect(), host = scroller.getBoundingClientRect();
  const top = box.top - host.top + scroller.scrollTop;
  if (block === "start") scroller.scrollTop = top;
  else if (block === "center") scroller.scrollTop = top - (scroller.clientHeight - box.height) / 2;
  else if (box.top < host.top) scroller.scrollTop = top;
  else if (box.bottom > host.bottom) scroller.scrollTop = top - scroller.clientHeight + box.height;
}
