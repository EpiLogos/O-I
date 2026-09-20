/** Shared source parser; headings are stable addresses, never UI copy. */
const headingPattern = /^(#{1,4})\s+\[([a-z0-9-]+)\]\s+(.+?)\s*$/i;

export function parsePublicContent(source) {
  const root = {
    id: '__root__',
    title: 'root',
    level: 0,
    bodyLines: [],
    children: [],
  };
  const stack = [root];

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(headingPattern);
    if (match) {
      const level = match[1].length;
      const node = {
        id: match[2],
        title: match[3].trim(),
        level,
        bodyLines: [],
        children: [],
      };

      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    if (stack.length > 1) {
      stack[stack.length - 1].bodyLines.push(line);
    }
  }

  const freeze = (node) => ({
    id: node.id,
    title: node.title,
    level: node.level,
    body: node.bodyLines
      .filter((line) => line.trim() !== '---')
      .join('\n')
      .trim(),
    children: node.children.map(freeze),
  });

  return root.children.map(freeze);
}

