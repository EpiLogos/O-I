/** The presented editor. The frame keeps far more mounted than it shows: the
 * rest frame stands mounted-hidden, other modes' and workspaces' trees wait in
 * `.warm-tree-host[hidden]`, and the pane tier retains every open tab's body
 * in `.surface-retained[hidden]` (the three-tier retention law). A bare
 * `.pane.focused .cm-content` therefore finds a concealed editor first, and
 * focusing a `display:none` element lands nowhere. Import-free so the entry
 * chunk can use it. */
export const PRESENTED_EDITOR = ".warm-tree-host:not([hidden]) .pane.focused .surface-retained:not([hidden]) .cm-content";
/** A pane's own presented editor (its unconcealed tab), relative to the pane. */
export const PANE_PRESENTED_EDITOR = ".surface-retained:not([hidden]) .cm-content";
