import '/@fs/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/projections/atlas/atlasHost.css'
import {registerFixtureProvider} from '/@fs/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/projections/atlas/provider/fixtureProvider.ts'
import {mountAtlas} from '/@fs/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui/src/projections/atlas/mount.ts'
registerFixtureProvider(true)
const w = window as any
try {
  w.H = await mountAtlas({globe: document.getElementById('globe')!, app: document.getElementById('app')!})
  w.READY = true
} catch (e) { w.FAILED = String(e) }
