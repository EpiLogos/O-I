const FRAME_TITLE_MAX = 160;
const FRAME_TITLE_HIT_HEIGHT = 14;
function frameTitleRecord(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let out = "";
  for (const character of trimmed) {
    if (out.length + character.length > FRAME_TITLE_MAX) break;
    out += character;
  }
  return out;
}
function frameTitleOf(title) {
  return typeof title === "string" ? title.trim() : "";
}
function frameHeadings(frames, boxOf, viewport) {
  const headings = [];
  for (const [id, frame] of Object.entries(frames)) {
    const boxes = frame.memberRefs.map((ref) => boxOf(ref)).filter((box) => !!box);
    if (!boxes.length) continue;
    const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const title = frameTitleOf(frame.title);
    headings.push({
      id,
      title,
      z: frame.z,
      left: left * viewport.zoom + viewport.x,
      top: top * viewport.zoom + viewport.y,
      width: (right - left) * viewport.zoom,
      hit: !title
    });
  }
  return headings.sort((a, b) => a.z - b.z);
}
export {
  FRAME_TITLE_HIT_HEIGHT,
  FRAME_TITLE_MAX,
  frameHeadings,
  frameTitleOf,
  frameTitleRecord
};
