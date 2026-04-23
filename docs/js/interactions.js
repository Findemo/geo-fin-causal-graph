import { setSelection, resetSelection } from "./state.js";
let detailElRef = null;

function narrativeIdsForEvent(model, eventId) {
  return (model.narrativesByEvent.get(eventId) || []).map((n) => n.narrative_id);
}

function chainStepIdsForEvent(model, eventId) {
  return model.eventToMarketPath.get(eventId) || [];
}

function edgeId(source, target) {
  return `${source}__${target}`;
}

function selectEvent(model, eventId) {
  const nodeIds = [eventId];
  const edgeIds = [];
  const ns = narrativeIdsForEvent(model, eventId);
  const steps = chainStepIdsForEvent(model, eventId);

  for (const nid of ns) {
    nodeIds.push(nid);
    edgeIds.push(edgeId(eventId, nid));
    if (steps[0]) edgeIds.push(edgeId(nid, steps[0]));
  }
  for (const sid of steps) nodeIds.push(sid);
  for (let i = 0; i < steps.length - 1; i++) {
    edgeIds.push(edgeId(steps[i], steps[i + 1]));
  }
  setSelection(eventId, nodeIds, edgeIds, eventId);
}

function selectNarrative(model, narrativeId) {
  const n = model.nodeById.get(narrativeId);
  if (!n) return;
  const eventId = n.event_id;
  const steps = chainStepIdsForEvent(model, eventId);
  const nodeIds = [eventId, narrativeId, ...steps];
  const edgeIds = [edgeId(eventId, narrativeId)];
  if (steps[0]) edgeIds.push(edgeId(narrativeId, steps[0]));
  for (let i = 0; i < steps.length - 1; i++) {
    edgeIds.push(edgeId(steps[i], steps[i + 1]));
  }
  setSelection(narrativeId, nodeIds, edgeIds, eventId);
}

function selectMarket(model, stepId) {
  const relatedEventIds = [...(model.marketToEventIds.get(stepId) || [])];
  const nodeIds = [stepId, ...relatedEventIds];
  const edgeIds = [];
  for (const eid of relatedEventIds) {
    const steps = chainStepIdsForEvent(model, eid);
    if (!steps.length) continue;
    if (steps.includes(stepId)) {
      nodeIds.push(...steps);
      for (let i = 0; i < steps.length - 1; i++) {
        edgeIds.push(edgeId(steps[i], steps[i + 1]));
      }
    }
  }
  setSelection(stepId, nodeIds, edgeIds, null);
}

function esc(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function eventDetailHtml(model, eventNode) {
  const d = eventNode.data;
  const chain = model.chainByEvent.get(d.event_id)?.chain || [];
  const chainHtml =
    chain.length > 0
      ? `<ol>${chain.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
      : "<div>暂无因果链</div>";
  const urlHtml = d.url
    ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.url)}</a>`
    : "无";
  return `
    <div><strong>Event:</strong> ${esc(d.event_id)}</div>
    <div><strong>标题:</strong> ${esc(d.title)}</div>
    <div><strong>时间:</strong> ${esc(d.datetime)}</div>
    <div><strong>地点:</strong> ${esc(d.location)}</div>
    <div><strong>类型:</strong> ${esc(d.event_type)}</div>
    <div><strong>来源:</strong> ${esc(d.source)}</div>
    <div><strong>URL:</strong> ${urlHtml}</div>
    <div style="margin-top:8px;"><strong>Fact:</strong> ${esc(d.summary)}</div>
    <div style="margin-top:10px;"><strong>Market Causal Chain:</strong>${chainHtml}</div>
  `;
}

function detailHtml(model, node) {
  if (!node) return "点击节点查看详情";
  if (node.layer === "event") {
    return eventDetailHtml(model, node);
  }
  if (node.layer === "report" || node.layer === "prediction") {
    const d = node.data;
    return `
      <div><strong>Narrative:</strong> ${esc(d.narrative_id)}</div>
      <div><strong>事件:</strong> ${esc(d.event_id)}</div>
      <div><strong>类型:</strong> ${esc(d.type)}</div>
      <div><strong>来源:</strong> ${esc(d.source)}</div>
      <div><strong>日期:</strong> ${esc(d.date)}</div>
      ${d.stance ? `<div><strong>立场:</strong> ${esc(d.stance)}</div>` : ""}
      ${d.confidence ? `<div><strong>置信度:</strong> ${esc(d.confidence)}</div>` : ""}
      <div style="margin-top:8px;">${esc(d.content || "")}</div>
    `;
  }
  const d = node.data;
  return `
    <div><strong>Market Node:</strong> ${esc(node.id)}</div>
    <div style="margin-top:8px;">${esc(d.text || "")}</div>
  `;
}

export function bindInteractions(model) {
  const detailEl = document.getElementById("detail");
  detailElRef = detailEl;
  const tooltip = document.getElementById("tooltip");

  document.getElementById("nodes-layer").addEventListener("click", (e) => {
    const target = e.target.closest(".node");
    if (!target) return;
    const id = target.getAttribute("data-node-id");
    const node = model.nodeById.get(id);
    if (!node) return;

    if (node.layer === "event") selectEvent(model, id);
    else if (node.layer === "report" || node.layer === "prediction") selectNarrative(model, id);
    else selectMarket(model, id);

    detailEl.innerHTML = detailHtml(model, node);
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    resetSelection();
    detailEl.textContent = "点击节点查看详情";
  });

  document.getElementById("search-btn").addEventListener("click", () => {
    const input = document.getElementById("search-input");
    const eid = (input.value || "").trim().toUpperCase();
    const node = model.nodeById.get(eid);
    if (!node || node.layer !== "event") return;
    focusEvent(model, eid);
  });

  document.getElementById("nodes-layer").addEventListener("mousemove", (e) => {
    const target = e.target.closest(".node");
    if (!target) {
      tooltip.classList.add("hidden");
      return;
    }
    const id = target.getAttribute("data-node-id");
    const node = model.nodeById.get(id);
    if (!node) return;
    const text =
      node.layer === "event"
        ? `${node.data.title || ""}\n${node.data.summary || ""}`.trim()
        : node.layer === "market"
          ? node.data.text
          : node.data.content;
    tooltip.textContent = text || "无内容";
    tooltip.style.left = `${e.clientX + 14}px`;
    tooltip.style.top = `${e.clientY + 14}px`;
    tooltip.classList.remove("hidden");
  });

  document.getElementById("nodes-layer").addEventListener("mouseleave", () => {
    tooltip.classList.add("hidden");
  });
}

export function focusEvent(model, eventId) {
  const node = model.nodeById.get(eventId);
  if (!node || node.layer !== "event") return;
  selectEvent(model, eventId);
  if (detailElRef) detailElRef.innerHTML = detailHtml(model, node);
}

