import "./kinds";
import type {SurfaceBinding} from "../../surface/types";
import {ObjectPage} from "./ObjectPage";
import {decodeObjectRef} from "./registry";

/** The surface body of an object page tab (binding kind "object"): the
 *  binding's ref is the page's identity (registry.encodeObjectRef), so a
 *  docked tab, a restored tab and a popped-out window show the same object. */
export function ObjectSurface({binding,onBack}:{binding:SurfaceBinding;onBack?:()=>void}) {
 const object=decodeObjectRef(binding.ref,binding.title);
 if(!object)return <p className="object-note" role="status">This page names no object.</p>;
 return <ObjectPage object={object} onBack={onBack}/>;
}
