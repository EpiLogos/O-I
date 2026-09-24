// Keep Cradle's real owner-payload conversion outside the Expressions TS realm.
import {readFile, writeFile} from 'node:fs/promises';
import {wikiReadingPayload} from '../src/techne/wikiReadingProvider.ts';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Native artifact and reading destination are required');
const actual = JSON.parse(await readFile(source, 'utf8'));
const reading = wikiReadingPayload({
  register: actual.register,
  subject: {kind: 'wiki', ref: `wiki:${actual.register.key}`, title: actual.register.title},
  reading: actual.reading,
  document: actual.document,
});
await writeFile(destination, JSON.stringify(reading));
