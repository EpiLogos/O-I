import {EngineSurface} from "../src/stage/engineSurface";
import {blankScene,entity} from "../expressions-app/field-studies-journeys/src/model";
import {nativeExport} from "../expressions-app/field-studies-journeys/src/nativeBridge";
import {naraExpressionConfig,naraRetainedPresentation,projectNaraExpression,exportNaraCues,naraCueExpression} from "../src/instrument/nara-expression-adapter";
Object.assign(window,{NaraRetainedTest:{EngineSurface,blankScene,entity,nativeExport,naraExpressionConfig,naraRetainedPresentation,projectNaraExpression,exportNaraCues,naraCueExpression}});
