import { edgePath } from "./layout.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function make(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function makeEdge(source, target, kind) {
  return { id: `${source}__${target}`, source, target, kind };
}

function inferRelation(sourceText, targetText) {
  const s = String(sourceText || "");
  const t = String(targetText || "");
  if (/[先前|之前|随后|之后|进一步|再度]/.test(`${s}${t}`)) {
    return { key: "temporal", label: "时序 before/after" };
  }
  if (/[上涨|上行|抬升|走高|扩大]/.test(t)) {
    return { key: "effect_pos", label: "正作用 (+)" };
  }
  if (/[下跌|下行|回落|缓解|收敛]/.test(t)) {
    return { key: "effect_neg", label: "负作用 (-)" };
  }
  if (/[担忧|预期|风险情绪|风险偏好]/.test(`${s}${t}`)) {
    return { key: "explain", label: "解释/支撑 ⇒" };
  }
  if (/[与|及|叠加|共同|同时]/.test(s)) {
    return { key: "co_cause", label: "并行驱动 A+B→C" };
  }
  return { key: "causal", label: "因果 A→B" };
}

function visibleNodes(model, focusedEventId) {
  const visible = new Set([...model.marketNodeIds]);
  if (!focusedEventId) return visible;
  const ms = model.eventToMarketPath.get(focusedEventId) || [];
  for (const id of ms) visible.add(id);
  return visible;
}

function narrativeAnchors(model, focusedEventId, layoutWidth) {
  if (!focusedEventId) return [];
  const ns = (model.narrativesByEvent.get(focusedEventId) || []).map((n) => n.narrative_id);
  const count = ns.length;
  const startX = Math.max(120, Math.round(layoutWidth * 0.1));
  const endX = Math.max(startX + 200, Math.round(layoutWidth * 0.9));
  const y = 120;
  return ns.map((nid, idx) => {
    const t = count <= 1 ? 0.5 : idx / (count - 1);
    const x = startX + t * (endX - startX);
    return { nid, anchorId: `NA-${nid}`, x, y };
  });
}

function visibleEdges(model, focusedEventId, layoutWidth) {
  const edges = [];
  if (!focusedEventId) return { edges, anchors: [] };
  const anchors = narrativeAnchors(model, focusedEventId, layoutWidth);
  const ms = model.eventToMarketPath.get(focusedEventId) || [];
  for (let i = 0; i < ms.length - 1; i++) {
    const e = makeEdge(ms[i], ms[i + 1], "market_chain_step");
    const src = model.nodeById.get(ms[i]);
    const tgt = model.nodeById.get(ms[i + 1]);
    const rel = inferRelation(src?.data?.text, tgt?.data?.text);
    edges.push({ ...e, relation: rel });
  }
  return { edges, anchors };
}

function drawScaffold(edgesLayer, layout) {
  const disc = make("ellipse", {
    cx: layout.marketDisc.cx,
    cy: layout.marketDisc.cy,
    rx: layout.marketDisc.rx,
    ry: layout.marketDisc.ry,
    class: "market-disc",
  });
  edgesLayer.appendChild(disc);
}

export function renderGraph(svg, model, layout, focusedEventId = null) {
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  const edgesLayer = document.getElementById("edges-layer");
  const nodesLayer = document.getElementById("nodes-layer");
  edgesLayer.innerHTML = "";
  nodesLayer.innerHTML = "";

  drawScaffold(edgesLayer, layout);
  const activeNodeIds = visibleNodes(model, focusedEventId);
  const edgeLayoutPositions = new Map(layout.positions);
  const { edges, anchors } = visibleEdges(model, focusedEventId, layout.width);
  for (const a of anchors) {
    edgeLayoutPositions.set(a.anchorId, { x: a.x, y: a.y });
  }
  for (const edge of edges) {
    const d = edgePath({ positions: edgeLayoutPositions }, edge);
    if (!d) continue;
    const path = make("path", {
      d,
      class: "edge",
      "data-edge-id": edge.id,
      "data-source": edge.source,
      "data-target": edge.target,
      "marker-end": "url(#arrow-end)",
    });
    edgesLayer.appendChild(path);

    const sp = edgeLayoutPositions.get(edge.source);
    const tp = edgeLayoutPositions.get(edge.target);
    if (sp && tp && edge.relation) {
      const mx = (sp.x + tp.x) / 2;
      const my = (sp.y + tp.y) / 2;
      const labelBg = make("rect", {
        x: mx - 48,
        y: my - 10,
        width: 96,
        height: 18,
        rx: 4,
        ry: 4,
        class: `edge-label-bg rel-${edge.relation.key}`,
        "data-edge-id": edge.id,
      });
      const label = make("text", {
        x: mx,
        y: my + 2,
        class: `edge-label rel-${edge.relation.key}`,
        "data-edge-id": edge.id,
      });
      label.textContent = edge.relation.label;
      edgesLayer.appendChild(labelBg);
      edgesLayer.appendChild(label);
    }
  }

  for (const node of model.nodes) {
    if (!activeNodeIds.has(node.id)) continue;
    const p = layout.positions.get(node.id);
    if (!p) continue;
    const g = make("g", {
      class: `node ${node.layer}`,
      "data-node-id": node.id,
      transform: `translate(${p.x - p.w / 2}, ${p.y - p.h / 2})`,
    });
    const rect = make("rect", {
      width: p.w,
      height: p.h,
      rx: 8,
      ry: 8,
    });
    const text = make("text", {
      x: p.w / 2,
      y: p.h / 2,
    });
    text.textContent = node.label;
    g.appendChild(rect);
    g.appendChild(text);
    nodesLayer.appendChild(g);
  }
}

export function applyHighlight(state) {
  const nodes = document.querySelectorAll(".node");
  const edges = document.querySelectorAll(".edge");
  const edgeLabels = document.querySelectorAll(".edge-label, .edge-label-bg");
  const hasSelection = state.highlightedNodeIds.size > 0;

  nodes.forEach((el) => {
    const id = el.getAttribute("data-node-id");
    el.classList.remove("active-node", "dimmed");
    if (!hasSelection) return;
    if (state.highlightedNodeIds.has(id)) {
      el.classList.add("active-node");
    } else {
      el.classList.add("dimmed");
    }
  });

  edges.forEach((el) => {
    const id = el.getAttribute("data-edge-id");
    el.classList.remove("active-edge", "dimmed");
    if (!hasSelection) return;
    if (state.highlightedEdgeIds.has(id)) {
      el.classList.add("active-edge");
    } else {
      el.classList.add("dimmed");
    }
  });

  edgeLabels.forEach((el) => {
    const id = el.getAttribute("data-edge-id");
    el.classList.remove("dimmed");
    if (!hasSelection) return;
    if (!state.highlightedEdgeIds.has(id)) {
      el.classList.add("dimmed");
    }
  });
}

