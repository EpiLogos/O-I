import {NodeResizeControl, type Node, type NodeProps} from "@xyflow/react";
import type {ReactElement} from "react";

/** lane-1 A2 — sticky, shape and text occurrences on the Research Canvas.
 * Presentation only: the label is `data.title`, the fill a CSS token value in
 * `data.style.bgColour` (the host maps palette keys to tokens, never raw
 * colours), and the geometry is the node type. These nodes carry no handles:
 * they move, align, frame and delete like any card, not connect. Stillness is
 * the canvas's own: no ambient motion here. */
export interface CanvasObjectData {
  title: string;
  readOnly?: boolean;
  style?: {bgColour?: string; textColour?: string};
  [key: string]: unknown;
}
export type CanvasObjectNodeType = Node<CanvasObjectData, "sticky" | "text" | "rectangle" | "ellipse" | "diamond">;
export type ShapeGeometry = "rectangle" | "ellipse" | "diamond";

function ObjectResize({selected, readOnly}: {selected?: boolean; readOnly?: boolean}) {
  return (
    <NodeResizeControl
      minWidth={40}
      minHeight={40}
      position="bottom-right"
      className="node-resize-control node-resize-control--bottom-right"
      style={{display: selected && !readOnly ? "flex" : "none"}}
    >
      <div className="node-resize-grip" />
    </NodeResizeControl>
  );
}

export function StickyNode({id, data, selected}: NodeProps<CanvasObjectNodeType>) {
  return (
    <div
      className="canvas-object canvas-object--sticky"
      data-testid={`sticky-node-${id}`}
      data-selected={selected ? "true" : "false"}
      style={{background: data.style?.bgColour}}
    >
      <ObjectResize selected={selected} readOnly={data.readOnly} />
      <span className="canvas-object__label">{data.title}</span>
    </div>
  );
}

export function TextNode({id, data, selected}: NodeProps<CanvasObjectNodeType>) {
  return (
    <div
      className="canvas-object canvas-object--text"
      data-testid={`text-node-${id}`}
      data-selected={selected ? "true" : "false"}
    >
      <ObjectResize selected={selected} readOnly={data.readOnly} />
      <span className="canvas-object__label">{data.title}</span>
    </div>
  );
}

const OUTLINE: Record<ShapeGeometry, ReactElement> = {
  rectangle: <rect x="0" y="0" width="100" height="100" />,
  ellipse: <ellipse cx="50" cy="50" rx="50" ry="50" />,
  diamond: <polygon points="50,0 100,50 50,100 0,50" />,
};

/** One shape node per geometry; the outline scales to the card, its stroke does not (vector-effect in the instrument stylesheet). */
function ShapeNode({id, data, selected, geometry}: NodeProps<CanvasObjectNodeType> & {geometry: ShapeGeometry}) {
  return (
    <div
      className={`canvas-object canvas-object--shape canvas-object--${geometry}`}
      data-testid={`${geometry}-node-${id}`}
      data-selected={selected ? "true" : "false"}
    >
      <ObjectResize selected={selected} readOnly={data.readOnly} />
      <svg className="canvas-object__shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g style={{fill: data.style?.bgColour ?? "none"}}>{OUTLINE[geometry]}</g>
      </svg>
      <span className="canvas-object__label">{data.title}</span>
    </div>
  );
}

export const RectangleNode = (props: NodeProps<CanvasObjectNodeType>) => <ShapeNode {...props} geometry="rectangle" />;
export const EllipseNode = (props: NodeProps<CanvasObjectNodeType>) => <ShapeNode {...props} geometry="ellipse" />;
export const DiamondNode = (props: NodeProps<CanvasObjectNodeType>) => <ShapeNode {...props} geometry="diamond" />;
