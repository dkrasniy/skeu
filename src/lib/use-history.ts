"use client";

import { useCallback, useReducer } from "react";
import { type EditorDocument, INITIAL_DOCUMENT } from "./editor-state";

interface History { past: EditorDocument[]; present: EditorDocument; future: EditorDocument[]; grouping: boolean; captured: boolean }
type Action = { type: "update"; change: (doc: EditorDocument) => EditorDocument } | { type: "restore"; doc: EditorDocument } | { type: "undo" | "redo" | "begin" | "end" };

function reducer(state: History, action: Action): History {
  if (action.type === "restore") return { ...state, present: action.doc, past: [], future: [] };
  if (action.type === "begin") return { ...state, grouping: true, captured: false };
  if (action.type === "end") return { ...state, grouping: false, captured: false };
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return { ...state, present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future], grouping: false, captured: false };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return { ...state, present: state.future[0], past: [...state.past, state.present], future: state.future.slice(1), grouping: false, captured: false };
  }
  if (action.type !== "update") return state;
  const present = action.change(state.present);
  if (present.asset === state.present.asset && present.name === state.present.name && JSON.stringify(present.settings) === JSON.stringify(state.present.settings)) return state;
  const capture = !state.grouping || !state.captured;
  return { ...state, present, past: capture ? [...state.past.slice(-49), state.present] : state.past, future: [], captured: true };
}

export function useHistory() {
  const [history, dispatch] = useReducer(reducer, { past: [], present: INITIAL_DOCUMENT, future: [], grouping: false, captured: false });
  const update = useCallback((change: (doc: EditorDocument) => EditorDocument) => dispatch({ type: "update", change }), []);
  const begin = useCallback(() => dispatch({ type: "begin" }), []);
  const end = useCallback(() => dispatch({ type: "end" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const restore = useCallback((doc: EditorDocument) => dispatch({ type: "restore", doc }), []);
  return { doc: history.present, update, begin, end, undo, redo, restore, adjusting: history.grouping, canUndo: !!history.past.length, canRedo: !!history.future.length };
}
