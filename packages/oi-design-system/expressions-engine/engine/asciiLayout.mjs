function asciiLayout(text, width, height, requested) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n"), columns = Math.max(1, ...lines.map((l) => Array.from(l).length));
  const fit = Math.min(width * 0.82 / (columns * 0.6), height * 0.82 / (Math.max(1, lines.length) * 1.15));
  const fontSize = Math.max(0.1, Math.min(requested && requested > 0 ? requested : 72, fit));
  return { lines, fontSize, charWidth: fontSize * 0.6, lineHeight: fontSize * 1.15 };
}
export {
  asciiLayout
};
