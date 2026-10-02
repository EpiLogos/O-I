// A production Explore surface over the actual admitted field owner. This
// harness creates no subjects, publications, grants or transport responses.
import {createRoot} from "react-dom/client";
import {KernelProvider} from "../src/kernel/KernelProvider";
import {VisualsProvider} from "../src/visuals/ParticleExpression";
import {ExpressionStageProvider} from "../src/stage/ExpressionStage";
import {ExploreSurface} from "../src/explore/ExploreSurface";
import "@epilogos/oi-design-system/tokens.css";
import "../src/explore/explore.css";
createRoot(document.getElementById("root")!).render(<KernelProvider><VisualsProvider><ExpressionStageProvider><ExploreSurface binding={{kind:"explore",title:"Explore"}}/></ExpressionStageProvider></VisualsProvider></KernelProvider>);
