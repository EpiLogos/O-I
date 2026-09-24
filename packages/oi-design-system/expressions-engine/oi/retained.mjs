/** O:I host bindings over the shared retained-field capability. */
import { ProductionAdapter as NativeProductionAdapter } from "../shell/production.mjs";
import { WORLD_SCALE } from "../shell/nativeParameters.mjs";
import { withRetainedField } from "./retained-capability.mjs";
import { ExpressionConnectionLayer } from "./expressionBindings.mjs";

const RetainedBase = withRetainedField(NativeProductionAdapter, WORLD_SCALE);
export class RetainedProductionAdapter extends RetainedBase {
  expressionBindings = [];
  connectionLayer = null;
  setExpressionBindings(bindings = []) {
    this.expressionBindings = bindings;
    this.dirty = true;
  }
  render(frame) {
    // Install on the actual field; its target update resolves current 3D
    // poses before the existing particle simulation step.
    if (this.connectionLayer && this.connectionLayer.engine !== this.engine) {
      this.connectionLayer.dispose(); this.connectionLayer = null;
    }
    this.connectionLayer?.configure(this.expressionBindings, frame.selectedIds);
    super.render(frame);
    if (this.expressionBindings.length && !this.connectionLayer && this.engine) {
      this.connectionLayer = new ExpressionConnectionLayer(this.engine);
      this.connectionLayer.configure(this.expressionBindings, frame.selectedIds);
      // First attachment paints once without advancing/reseeding the clock.
      this.engine.advance(0);
    }
  }
  hitTestExpression(x, y) {
    if (!this.engine || this.contextLost) return null;
    const relation = this.connectionLayer?.hitTest(x, y);
    // Prefer an actual member centre within 12px; connections retain their
    // own independently selectable midpoints, including parallel records.
    let member = null, distance = 12;
    for (const pose of this.engine.lastPoses ?? []) {
      const p = this.engine.projectWorldToScreen(pose.x, pose.y, pose.z ?? 0);
      if (!p.visible) continue;
      const d = Math.hypot(x-p.x,y-p.y);
      if (d <= distance) {distance=d;member={kind:"entity",entity_ref:pose.entityId,distance:d};}
    }
    return member ?? relation ?? null;
  }
  expressionBindingSnapshot() {
    return this.connectionLayer?.inspect() ?? {rendered:[],unavailable:this.expressionBindings.map(b=>b.binding_ref)};
  }
  dispose() {
    this.connectionLayer?.dispose();
    this.connectionLayer = null;
    super.dispose();
  }
}
export { RetainedProductionAdapter as ProductionAdapter };
