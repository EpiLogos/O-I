import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeMarker,
  type Connection,
  ConnectionMode,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes
} from "@xyflow/react";
import type { ComponentType } from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Annotation,
  AnnotationPoint,
  CanvasEdge,
  CanvasNode,
} from "@research-canvas/schema";

import { AnnotationLayer } from "./annotations/AnnotationLayer";
import { AnnotatedEdge } from "./edges/AnnotatedEdge";
import { SequenceMap } from "./sequences/SequenceMap";
import { walkSequenceGraph } from "./sequences/walkSequenceGraph";
import { ContextMenu, type MenuItem } from "./components/ContextMenu";
import { FuzzyFilePicker, type FileEntry } from "./components/FuzzyFilePicker";
import { defaultRelationshipKind } from "./state/canvasStore";
import { GroupNode } from "./nodes/GroupNode";
import { ImageNode } from "./nodes/ImageNode";
import { NoteNode } from "./nodes/NoteNode";
import { ResourceNode } from "./nodes/ResourceNode";
import { defaultSourceHandleId, defaultTargetHandleId } from "./nodes/nodeHandles";

export interface CanvasViewProps {
  /** Optional host HUD. Omitted keeps the standalone toolbar and controls. */
  toolbarContainer?: HTMLElement | null;
  /** Owner supplies no write capability; preserve navigation and selection only. */
  readOnly?: boolean;
  /** A source-owned relation can remain read-only inside an editable Scene. */
  isEdgeReadOnly?: (edgeId: string) => boolean;
  /** Changes whenever the active workspace canvas changes. */
  canvasKey?: string;
  /** A persisted or tab-local viewport to restore after a canvas switch. */
  initialViewport?: { x: number; y: number; zoom: number } | null;
  edges: CanvasEdge[];
  nodes: CanvasNode[];
  onMoveNode?: (nodeId: string, position: { x: number; y: number }) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  onSelectNode?: (nodeId: string | null) => void;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onCreateNote?: (position?: { x: number; y: number }) => void;
  onCreateGroup?: (position?: { x: number; y: number }) => void;
  onCreateResourceFromFile?: (entry: FileEntry, position: { x: number; y: number }) => void;
  onCreateImageFromFile?: (entry: FileEntry, position: { x: number; y: number }) => void;
  fileEntries?: FileEntry[];
  onUpdateImageCaption?: (nodeId: string, caption: string) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  onConnectNodes?: (input: {
    sourceNodeId: string;
    targetNodeId: string;
    relationKind: string;
    sourceHandleId?: string;
    targetHandleId?: string;
    directionality?: CanvasEdge["directionality"];
  }) => void;
  onReconnectEdge?: (
    edgeId: string,
    input: {
      sourceNodeId: string;
      targetNodeId: string;
      sourceHandleId?: string;
      targetHandleId?: string;
    }
  ) => void;
  onCycleEdgeDirectionality?: (edgeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onUpdateEdgeRelationKind?: (edgeId: string, relationKind: string) => void;
  onResizeNode?: (nodeId: string, width: number, height: number) => void;
  onUpdateNoteContent?: (nodeId: string, content: string) => void;
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  annotations?: Annotation[];
  drawingEnabled?: boolean;
  onCreateStroke?: (points: AnnotationPoint[]) => void;
  onRegisterFlyToNode?: (flyTo: (nodeId: string, viewport?: { x: number; y: number; zoom: number }) => void) => void;
  onRegisterFlyToEdge?: (flyTo: (edgeId: string, viewport?: { x: number; y: number; zoom: number }) => void) => void;
  onRegisterCaptureViewport?: (
    capture: () => { x: number; y: number; zoom: number }
  ) => void;
  onToggleEdgeSequencing?: (edgeId: string) => void;
  onPlaySequence?: () => void;
  /** Host-specific URL adapter for local resource thumbnails (e.g. Tauri asset://). */
  assetUrlForPath?: (absolutePath: string) => string;
  /** Normalizes stored thumbnail URLs owned by the desktop host. */
  resolveAssetUrl?: (url: string) => string;
}

const nodeTypes: NodeTypes = {
  group: GroupNode,
  image: ImageNode,
  note: NoteNode,
  resource: ResourceNode
};

const edgeTypes: Record<string, ComponentType<any>> = {
  annotated: AnnotatedEdge
};

export function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <CanvasViewInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasViewInner({
  toolbarContainer = null,
  readOnly = false,
  isEdgeReadOnly,
  canvasKey,
  initialViewport = null,
  edges,
  nodes,
  onMoveNode,
  onSelectEdge,
  onSelectNode,
  selectedNodeId,
  selectedEdgeId,
  onDeleteNode,
  onDuplicateNode,
  onCreateNote,
  onCreateGroup,
  onCreateResourceFromFile,
  onCreateImageFromFile,
  fileEntries,
  onUpdateImageCaption,
  onNodeDoubleClick,
  onConnectNodes,
  onReconnectEdge,
  onCycleEdgeDirectionality,
  onDeleteEdge,
  onUpdateEdgeRelationKind,
  onResizeNode,
  onUpdateNoteContent,
  annotations = [],
  drawingEnabled = false,
  onCreateStroke,
  onRegisterFlyToNode,
  onRegisterFlyToEdge,
  onRegisterCaptureViewport,
  onToggleEdgeSequencing,
  onPlaySequence,
  assetUrlForPath,
  resolveAssetUrl,
}: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView, getViewport, getZoom, screenToFlowPosition, setCenter, setViewport, zoomIn, zoomOut } =
    useReactFlow();

  const getViewportCenter = useCallback(() => {
    const container = document.querySelector('.canvas-flow') as HTMLElement;
    if (!container) return { x: 100, y: 100 };
    const rect = container.getBoundingClientRect();
    return screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
  }, [screenToFlowPosition]);

  const prevNodeCountRef = useRef(nodes.length);
  useEffect(() => {
    if (nodes.length > prevNodeCountRef.current) {
      const newest = nodes[nodes.length - 1];
      if (newest) {
        setCenter(newest.position.x + 80, newest.position.y + 60, {
          duration: 350,
          zoom: Math.max(1, getZoom()),
        });
      }
    }
    prevNodeCountRef.current = nodes.length;
  }, [nodes, setCenter, getZoom]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialViewport) {
        void setViewport(initialViewport, { duration: 0 });
      } else {
        void fitView({ padding: 0.15 });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [canvasKey, fitView, initialViewport, setViewport]);

  const flyToNode = useCallback(
    (nodeId: string, viewport?: { x: number; y: number; zoom: number }) => {
      if (viewport) {
        void setViewport(viewport, { duration: 500 });
      } else {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          setCenter(
            node.position.x + (node.size?.width ?? 200) / 2,
            node.position.y + (node.size?.height ?? 140) / 2,
            { duration: 500, zoom: Math.max(1, getZoom()) }
          );
        }
      }
    },
    [nodes, setCenter, getZoom]
  );

  const flyToEdge = useCallback(
    (edgeId: string, viewport?: { x: number; y: number; zoom: number }) => {
      if (viewport) {
        void setViewport(viewport, { duration: 500 });
        return;
      }

      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge) {
        return;
      }

      const source = nodes.find((candidate) => candidate.id === edge.sourceNodeId);
      const target = nodes.find((candidate) => candidate.id === edge.targetNodeId);
      if (!source || !target) {
        return;
      }

      const sourceCenter = {
        x: source.position.x + (source.size?.width ?? 200) / 2,
        y: source.position.y + (source.size?.height ?? 140) / 2,
      };
      const targetCenter = {
        x: target.position.x + (target.size?.width ?? 200) / 2,
        y: target.position.y + (target.size?.height ?? 140) / 2,
      };

      setCenter((sourceCenter.x + targetCenter.x) / 2, (sourceCenter.y + targetCenter.y) / 2, {
        duration: 500,
        zoom: Math.max(1, getZoom()),
      });
    },
    [edges, nodes, setCenter, setViewport, getZoom]
  );

  useEffect(() => {
    onRegisterFlyToNode?.(flyToNode);
  }, [flyToNode, onRegisterFlyToNode]);

  useEffect(() => {
    onRegisterFlyToEdge?.(flyToEdge);
  }, [flyToEdge, onRegisterFlyToEdge]);

  useEffect(() => {
    onRegisterCaptureViewport?.(() => getViewport());
  }, [getViewport, onRegisterCaptureViewport]);

  const sequenceGraph = useMemo(
    () => walkSequenceGraph(nodes, edges),
    [nodes, edges]
  );

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    kind: "canvas" | "node" | "edge";
    nodeId?: string;
    edgeId?: string;
    canvasPos?: { x: number; y: number };
  } | null>(null);

  const [showFilePicker, setShowFilePicker] = useState<{
    x: number;
    y: number;
    canvasPos?: { x: number; y: number };
  } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const closeFilePicker = useCallback(() => setShowFilePicker(null), []);

  useEffect(() => {
    if (!editingNodeId) {
      return;
    }

    const editingNode = nodes.find((node) => node.id === editingNodeId);
    if (readOnly || !editingNode || editingNode.type !== "note") {
      setEditingNodeId(null);
    }
  }, [editingNodeId, nodes, readOnly]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.source || !connection.target) return;
      onConnectNodes?.({
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        relationKind: defaultRelationshipKind(),
        sourceHandleId: connection.sourceHandle ?? undefined,
        targetHandleId: connection.targetHandle ?? undefined,
        directionality: "forward",
      });
    },
    [onConnectNodes, readOnly],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      for (const change of changes) {
        if (change.type === "dimensions" && change.resizing && change.dimensions) {
          onResizeNode?.(change.id, change.dimensions.width, change.dimensions.height);
        }
      }
    },
    [onResizeNode, readOnly],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      if (!(e.target as HTMLElement)?.closest?.(".react-flow")) return;
      if (!readOnly && (e.key === "Delete" || e.key === "Backspace")) {
        const selected = nodes.find((n) => n.id === selectedNodeId);
        if (selected) {
          onDeleteNode?.(selected.id);
        } else if (selectedEdgeId && !isEdgeReadOnly?.(selectedEdgeId)) {
          onDeleteEdge?.(selectedEdgeId);
        }
      }
      if (!readOnly && (e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        const selected = nodes.find((n) => n.id === selectedNodeId);
        if (selected) onDuplicateNode?.(selected.id);
      }
      if (!readOnly && e.key === "n" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        onCreateNote?.(getViewportCenter());
      }
      if (e.key === "p" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (edges.some((edge) => edge.sequencing)) {
          onPlaySequence?.();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    onDeleteEdge,
    onDeleteNode,
    onDuplicateNode,
    onCreateNote,
    onPlaySequence,
    getViewportCenter,
    readOnly,
    isEdgeReadOnly,
  ]);

  const flowNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    type: node.type === "portal" ? "group" : node.type,
    position: node.position,
    width: node.size?.width,
    height: node.size?.height,
    data: {
      readOnly,
      summary:
        node.summary,
      nodeType: node.type === "portal" ? "portal" : node.type === "group" ? "group" : undefined,
      title: node.title,
      graph: node.graph,
      content: node.type === "note" ? node.content : node.type === "resource" ? node.relativePath : undefined,
      src: node.type === "image" ? node.src : undefined,
      caption: node.type === "image" ? node.caption ?? undefined : undefined,
      onCaptionChange:
        !readOnly && node.type === "image" && onUpdateImageCaption
          ? (caption: string) => onUpdateImageCaption?.(node.id, caption)
          : undefined,
      tags: node.type === "note" ? node.tags : undefined,
      resourceKind: node.type === "resource" ? node.resourceKind : undefined,
      absolutePath: node.type === "resource" ? node.absolutePath : undefined,
      isEditing: !readOnly && node.type === "note" ? node.id === editingNodeId : false,
      onContentChange:
        !readOnly && node.type === "note" && onUpdateNoteContent
          ? (content: string) => onUpdateNoteContent?.(node.id, content)
          : undefined,
      onStartEditing:
        !readOnly && node.type === "note" && onUpdateNoteContent
          ? () => {
              onSelectNode?.(node.id);
              onSelectEdge?.(null);
              setEditingNodeId(node.id);
            }
          : undefined,
      onStopEditing:
        !readOnly && node.type === "note" && onUpdateNoteContent
          ? () => setEditingNodeId((current) => (current === node.id ? null : current))
          : undefined,
      style: {
        dotColour: node.dotColour ?? undefined,
        bgColour: node.bgColour ?? undefined,
        textColour: node.textColour ?? undefined,
        thumbnail: node.thumbnail
          ? (resolveAssetUrl?.(node.thumbnail) ?? node.thumbnail)
          : (node.type === "resource" && node.resourceKind === "image" && node.absolutePath
            ? assetUrlForPath?.(node.absolutePath)
            : undefined),
      },
    },
    draggable: !readOnly && !!onMoveNode,
    selectable: true,
    selected: node.id === selectedNodeId
  }));

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    sourceHandle: edge.sourceHandleId ?? defaultSourceHandleId(),
    target: edge.targetNodeId,
    targetHandle: edge.targetHandleId ?? defaultTargetHandleId(),
    type: "annotated",
    reconnectable: !readOnly && !isEdgeReadOnly?.(edge.id) && !!onReconnectEdge,
    data: {
      readOnly: readOnly || !!isEdgeReadOnly?.(edge.id),
      directionality: edge.directionality,
      relationKind: edge.relationKind,
      note: edge.note,
      sequencing: edge.sequencing,
      onSelect: () => {
        onSelectNode?.(null);
        onSelectEdge?.(edge.id);
      },
      onCycleDirectionality: onCycleEdgeDirectionality ? () => onCycleEdgeDirectionality(edge.id) : undefined,
      onDelete: onDeleteEdge ? () => onDeleteEdge(edge.id) : undefined,
      onUpdateRelationKind: onUpdateEdgeRelationKind ? (relationKind: string) =>
        onUpdateEdgeRelationKind(edge.id, relationKind) : undefined,
      selected: edge.id === selectedEdgeId
    },
    ...(edge.sequencing
      ? { markerEnd: { type: MarkerType.ArrowClosed } }
      : edgeMarkers(edge.directionality)),
    selected: edge.id === selectedEdgeId,
    selectable: true
  }));

  const nodeContextMenuItems = useMemo(() => {
    if (!contextMenu?.nodeId) return [];
    const nodeId = contextMenu.nodeId;
    return [
      {
        type: "header" as const,
        label: flowNodes.find((n) => n.id === nodeId)?.data?.title as string ?? "Node",
      },
      { type: "separator" as const },
      ...(onNodeDoubleClick ? [{ type: "item" as const, label: "Open content", shortcut: "↵", onClick: () => onNodeDoubleClick(nodeId) }] : []),
      ...(onUpdateNoteContent && nodes.find((candidate) => candidate.id === nodeId)?.type === "note"
        ? [
            {
              type: "item" as const,
              label: "Edit note",
              onClick: () => {
                onSelectNode?.(nodeId);
                onSelectEdge?.(null);
                setEditingNodeId(nodeId);
              },
            },
          ]
        : []),
      { type: "separator" as const },
      ...(onDuplicateNode ? [{ type: "item" as const, label: "Duplicate", shortcut: "⌘D", onClick: () => onDuplicateNode(nodeId) }] : []),
      { type: "separator" as const },
      { type: "separator" as const },
      ...(onDeleteNode ? [{ type: "item" as const, label: "Delete", shortcut: "⌫", danger: true, onClick: () => onDeleteNode(nodeId) }] : []),
    ];
  }, [
    contextMenu,
    flowNodes,
    nodes,
    onNodeDoubleClick,
    onDuplicateNode,
    onDeleteNode,
    onUpdateNoteContent,
    onSelectEdge,
    onSelectNode,
  ],);

  const toolbar = (
      <div className={toolbarContainer ? "canvas-toolbar canvas-toolbar-hosted" : "canvas-toolbar"} data-testid="canvas-toolbar">
        <button type="button" aria-label="Zoom in" onClick={() => zoomIn?.()}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomOut?.()}>-</button>
        <button type="button" aria-label="Fit view" onClick={() => fitView({ padding: 0.15 })}>Fit</button>
        {onPlaySequence && edges.some((e) => e.sequencing) && (
          <button type="button" aria-label="Play sequence" onClick={() => onPlaySequence?.()}>Play</button>
        )}
      </div>
  );
  return (
    <div ref={containerRef} className="canvas-flow" data-testid="canvas-flow">
      {toolbarContainer ? createPortal(toolbar, toolbarContainer) : toolbar}
      <ReactFlow
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        edgeTypes={edgeTypes}
        edges={flowEdges}
        fitView
        nodes={flowNodes}
        nodeTypes={nodeTypes}
        nodesDraggable={!readOnly && !!onMoveNode}
        nodesConnectable={!readOnly && !!onConnectNodes}
        edgesReconnectable={!readOnly && !!onReconnectEdge}
        deleteKeyCode={null}
        nodesFocusable
        onDragOver={(e: React.DragEvent) => {
          if (readOnly) return;
          // Always prevent default to allow drops; validate content in onDrop
          // (WKWebView may not reliably support custom MIME types in DataTransfer)
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          if (readOnly) return;
          // Try custom type first, fall back to text/plain (WKWebView compatibility)
          const raw = e.dataTransfer.getData("application/x-canvas-entry")
            || e.dataTransfer.getData("text/plain");
          if (!raw) return;
          try {
            const entry = JSON.parse(raw) as {
              absolutePath?: string;
              id: string;
              kind: string;
              name: string;
              relativePath: string;
            };
            if (!entry.id || !entry.name || !entry.relativePath) return;
            const canvasPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            if (entry.kind === "image" && onCreateImageFromFile) {
              onCreateImageFromFile(
                {
                  absolutePath: entry.absolutePath,
                  id: entry.id,
                  kind: entry.kind,
                  name: entry.name,
                  path: entry.relativePath,
                  relativePath: entry.relativePath,
                },
                canvasPos
              );
              return;
            }
            onCreateResourceFromFile?.(
              {
                absolutePath: entry.absolutePath,
                id: entry.id,
                kind: entry.kind,
                name: entry.name,
                path: entry.relativePath,
                relativePath: entry.relativePath,
              },
              canvasPos
            );
          } catch {
            // not a canvas entry payload
          }
        }}
        onPaneClick={() => {
          setEditingNodeId(null);
          onSelectNode?.(null);
          onSelectEdge?.(null);
        }}
        onNodeClick={(_event, node) => {
          setEditingNodeId((current) => (current === node.id ? current : null));
          onSelectNode?.(node.id);
          onSelectEdge?.(null);
        }}
        onNodeDrag={(_event, node) => {
          if (!readOnly) onMoveNode?.(node.id, node.position);
        }}
        onNodeDragStop={(_event, node) => {
          if (!readOnly) onMoveNode?.(node.id, node.position);
        }}
        onNodeDoubleClick={(_e, node) => {
          setEditingNodeId(null);
          onNodeDoubleClick?.(node.id);
        }}
        onEdgeClick={(_event, edge) => {
          setEditingNodeId(null);
          onSelectNode?.(null);
          onSelectEdge?.(edge.id);
        }}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onReconnect={(oldEdge, newConnection) => {
          if (readOnly || isEdgeReadOnly?.(oldEdge.id) || !newConnection.source || !newConnection.target) {
            return;
          }
          onReconnectEdge?.(oldEdge.id, {
            sourceNodeId: newConnection.source,
            targetNodeId: newConnection.target,
            sourceHandleId: newConnection.sourceHandle ?? undefined,
            targetHandleId: newConnection.targetHandle ?? undefined,
          });
        }}
        reconnectRadius={20}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={!readOnly && !!onConnectNodes}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          if (!readOnly) setContextMenu({ x: e.clientX, y: e.clientY, kind: "canvas" });
        }}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          e.stopPropagation();
          if (!readOnly) setContextMenu({ x: e.clientX, y: e.clientY, kind: "node", nodeId: node.id });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          e.stopPropagation();
          if (!readOnly && !isEdgeReadOnly?.(edge.id)) setContextMenu({ x: e.clientX, y: e.clientY, kind: "edge", edgeId: edge.id });
        }}
        panOnDrag={true}
      >
        <Background color="rgba(244, 232, 208, 0.08)" gap={24} />
        {!toolbarContainer && <Controls showInteractive={false} />}
        {sequenceGraph.nodeSet.size > 0 && (
          <SequenceMap
            graph={sequenceGraph}
            nodes={nodes}
            onClickNode={(nodeId) => flyToNode(nodeId)}
          />
        )}
      </ReactFlow>
      <AnnotationLayer
        annotations={annotations}
        drawingEnabled={!readOnly && drawingEnabled}
        onCreateStroke={(points) => { if (!readOnly) onCreateStroke?.(points); }}
      />

      {!readOnly && contextMenu && contextMenu.kind === "canvas" && (
        <ContextMenu
          portalRoot={containerRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={availableMenu([
            { type: "item", label: "Add note", shortcut: "N", onClick: () => onCreateNote?.(screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })) },
            { type: "item", label: "Add image", shortcut: "I", onClick: () => setShowFilePicker({ x: contextMenu.x, y: contextMenu.y }) },
            {
              type: "item",
              label: "Add resource from file…",
              shortcut: "R",
              onClick: () => {
                setShowFilePicker({ x: contextMenu.x, y: contextMenu.y });
                setContextMenu(null);
              },
            },
            { type: "item", label: "Add group", shortcut: "G", onClick: () => onCreateGroup?.(getViewportCenter()) },
          ...(edges.some((e) => e.sequencing)
            ? [
                { type: "separator" as const },
                {
                  type: "item" as const,
                  label: "Play sequence",
                  shortcut: "P",
                  onClick: () => {
                    onPlaySequence?.();
                    closeContextMenu();
                  },
                },
              ]
            : []),
        ], {"Add note": !!onCreateNote, "Add image": !!onCreateImageFromFile, "Add resource from file…": !!onCreateResourceFromFile, "Add group": !!onCreateGroup, "Play sequence": !!onPlaySequence})}
      />
      )}

      {!readOnly && contextMenu?.nodeId && (
        <ContextMenu
          portalRoot={containerRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={availableMenu(nodeContextMenuItems,{})}
        />
      )}

      {!readOnly && contextMenu?.kind === "edge" && contextMenu.edgeId && !isEdgeReadOnly?.(contextMenu.edgeId) && (
        <ContextMenu
          portalRoot={containerRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={availableMenu([
            {
              type: "item",
              label: edges.find((e) => e.id === contextMenu.edgeId)?.sequencing
                ? "Remove from sequence"
                : "Mark as sequence arrow",
              onClick: () => {
                onToggleEdgeSequencing?.(contextMenu.edgeId!);
                closeContextMenu();
              },
            },
            { type: "separator" },
            {
              type: "item",
              label: "Cycle arrow direction",
              onClick: () => {
                onCycleEdgeDirectionality?.(contextMenu.edgeId!);
                closeContextMenu();
              },
            },
            {
              type: "item",
              label: "Delete connection",
              shortcut: "⌫",
              danger: true,
              onClick: () => {
                onDeleteEdge?.(contextMenu.edgeId!);
                onSelectEdge?.(null);
                closeContextMenu();
              },
            },
          ], {"Remove from sequence": !!onToggleEdgeSequencing, "Mark as sequence arrow": !!onToggleEdgeSequencing, "Cycle arrow direction": !!onCycleEdgeDirectionality, "Delete connection": !!onDeleteEdge})}
        />
      )}

      {!readOnly && showFilePicker && (
        <FuzzyFilePicker
          anchorX={showFilePicker.x}
          anchorY={showFilePicker.y}
          entries={fileEntries ?? []}
          onSelect={(entry) => {
            const canvasPos = screenToFlowPosition({ x: showFilePicker.x, y: showFilePicker.y });
            if (entry.kind === "image" && onCreateImageFromFile) {
              onCreateImageFromFile(entry, canvasPos);
            } else {
              onCreateResourceFromFile?.(entry, canvasPos);
            }
            setShowFilePicker(null);
          }}
          onClose={closeFilePicker}
        />
      )}
    </div>
  );
}

/** Keep only native callback-backed actions and meaningful separators. */
export function availableMenu(items: MenuItem[], capabilities: Record<string, boolean>): MenuItem[] {
 const kept=items.filter(item=>item.type!=='item'||(!!item.onClick&&!!item.label&&capabilities[item.label]!==false));
 return kept.filter((item,index)=>item.type!=='separator'||(index>0&&kept.slice(index+1).some(next=>next.type!=='separator')&&kept[index-1].type!=='separator'));
}

function edgeMarkers(directionality: CanvasEdge["directionality"]): {
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
} {
  const marker = { type: MarkerType.ArrowClosed };

  switch (directionality) {
    case "backward":
      return { markerStart: marker };
    case "bidirectional":
      return { markerStart: marker, markerEnd: marker };
    case "forward":
      return { markerEnd: marker };
    case "none":
    default:
      return {};
  }
}
