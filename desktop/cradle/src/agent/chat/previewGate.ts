/**
 * The developer preview's one seam: a window event the panel menus dispatch
 * and the agent layer listens for (the listener exists only in dev builds).
 * No store, no native call — a toggle that shows the chat components with
 * fixture state.
 */
export const CHAT_PREVIEW_EVENT="oi:chat-preview";

export interface ChatPreviewDetail {open:boolean}

export const isChatPreviewDetail=(detail:unknown):detail is ChatPreviewDetail=>
  typeof detail==="object"&&detail!==null&&typeof (detail as{open?:unknown}).open==="boolean";
