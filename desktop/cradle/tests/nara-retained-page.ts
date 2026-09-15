import {EngineSurface} from "../src/stage/engineSurface";
import {blankScene,entity} from "@epilogos/oi-design-system/expressions-engine/shell/model.mjs";
import {nativeExport} from "@epilogos/oi-design-system/expressions-engine/shell/nativeBridge.mjs";
import {naraExpressionConfig,naraRetainedPresentation,projectNaraExpression} from "../src/instrument/nara-expression-adapter";
Object.assign(window,{NaraRetainedTest:{EngineSurface,blankScene,entity,nativeExport,naraExpressionConfig,naraRetainedPresentation,projectNaraExpression}});
