/** Existing host export; capability code is shared with the embedded app. */
import { ProductionAdapter } from "../shell/production.mjs";
import { WORLD_SCALE } from "../shell/nativeParameters.mjs";
import { withRetainedField } from "./retained-capability.mjs";
export const RetainedProductionAdapter = withRetainedField(ProductionAdapter, WORLD_SCALE);
export { RetainedProductionAdapter as ProductionAdapter };
