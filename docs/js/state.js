const state = {
  selectedNodeId: null,
  focusedEventId: null,
  highlightedNodeIds: new Set(),
  highlightedEdgeIds: new Set(),
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setSelection(nodeId, nodeIds, edgeIds, focusedEventId = null) {
  state.selectedNodeId = nodeId;
  state.focusedEventId = focusedEventId;
  state.highlightedNodeIds = new Set(nodeIds);
  state.highlightedEdgeIds = new Set(edgeIds);
  notify();
}

export function resetSelection() {
  state.selectedNodeId = null;
  state.focusedEventId = null;
  state.highlightedNodeIds = new Set();
  state.highlightedEdgeIds = new Set();
  notify();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener(state);
}

