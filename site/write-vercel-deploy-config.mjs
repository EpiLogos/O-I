/** Restore the deploy-side config Vercel needs inside dist/ after each build:
 * the oi-epi-logos project link and the routing vercel.json. Vite empties
 * dist on every build, which had silently dropped both. */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = dirname(fileURLToPath(import.meta.url));
const dist = resolve(site, 'dist');

await mkdir(resolve(dist, '.vercel'), { recursive: true });
await writeFile(
  resolve(dist, '.vercel/project.json'),
  JSON.stringify({
    projectId: 'prj_aBBwZKwR5GUFS7llkRymfLKBRDmP',
    orgId: 'team_Jhohxk4J3oqTDYfistoePCpi',
    projectName: 'oi-epi-logos',
  }) + '\n',
);
await copyFile(resolve(site, 'vercel.json'), resolve(dist, 'vercel.json'));
console.log('Deploy config restored: dist/.vercel/project.json (oi-epi-logos), dist/vercel.json.');
