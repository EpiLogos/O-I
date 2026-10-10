import {defineConfig} from '../../live-shell/ui/node_modules/vite/dist/node/index.js';
import {instrumentEditorBundler} from '../src/receiving/vite.mjs';
/** Compile against the actual receiving Vite6 types under strict mode. */
export default defineConfig({plugins:[instrumentEditorBundler()]});
