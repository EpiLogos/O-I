import publicSiteSource from '../../content/public-site.md?raw';

export type ContentNode = {
  id: string;
  title: string;
  level: number;
  body: string;
  children: ContentNode[];
};

// The build and browser consume the same parser, not two copies of the prose.
import { parsePublicContent } from './public-parser.mjs';

function findChild(parent: ContentNode, id: string): ContentNode | undefined {
  return parent.children.find((node) => node.id === id);
}

function mustFind(nodes: ContentNode[], id: string, context: string): ContentNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`Public site content is missing ${context} [${id}] in site/content/public-site.md`);
  }
  return node;
}

export const publicPages = parsePublicContent(publicSiteSource);

export function getPage(id: string): ContentNode {
  return mustFind(publicPages, id, 'page');
}

export function getSection(pageId: string, sectionId: string): ContentNode {
  const page = getPage(pageId);
  return mustFind(page.children, sectionId, `section in page [${pageId}]`);
}

export function getChild(parent: ContentNode, id: string): ContentNode {
  const child = findChild(parent, id);
  if (!child) {
    throw new Error(`Public site content is missing child [${id}] below [${parent.id}]`);
  }
  return child;
}

export function getTitle(parent: ContentNode, childId = 'title'): string {
  return getChild(parent, childId).title;
}

export function getBody(parent: ContentNode, childId?: string): string {
  return childId ? getChild(parent, childId).body : parent.body;
}

export function getList(node: ContentNode): string[] {
  return node.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

const requiredPages = ['home', 'oi', 'products', 'shared-field', 'research', 'build'];
const productIds = ['central', 'actuation', 'aikit', 'factory', 'workcell', 'ql'];
const requiredProductFields = ['summary', 'lede', 'what', 'why', 'change', 'capabilities', 'repo'];

for (const pageId of requiredPages) {
  getPage(pageId);
}

for (const productId of productIds) {
  const product = getSection('products', productId);
  for (const fieldId of requiredProductFields) {
    getChild(product, fieldId);
  }
}

getChild(getSection('home', 'hero'), 'title');
