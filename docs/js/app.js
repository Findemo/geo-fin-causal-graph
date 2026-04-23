import { loadBundle } from "./data-loader.js";
import { buildGraphModel } from "./graph-model.js";
import { computeLayout } from "./layout.js";
import { renderGraph, applyHighlight } from "./render-svg.js";
import { bindInteractions, focusEvent } from "./interactions.js";
import { getState, subscribe } from "./state.js";

function chineseEventText(event) {
  const summary = String(event.summary || "").trim();
  const first = summary.split(/[。；;.!?]/)[0].trim();
  if (first) return first;
  return String(event.title || "").trim();
}

function renderEventList(model) {
  const list = document.getElementById("event-list");
  list.innerHTML = "";
  for (let i = 0; i < model.eventsOrdered.length; i++) {
    const event = model.eventsOrdered[i];
    const next = model.eventsOrdered[i + 1];
    const item = document.createElement("button");
    item.type = "button";
    item.className = "event-item";
    item.dataset.eventId = event.event_id;
    const date = String(event.datetime || "").slice(0, 10);
    item.innerHTML = `
      <div class="date">${date}</div>
      <div class="title">${chineseEventText(event)}</div>
      ${
        next
          ? `<div class="event-link">↘ 下一个事件：${String(next.datetime || "").slice(0, 10)} ${chineseEventText(next)}</div>`
          : ""
      }
    `;
    item.addEventListener("click", () => focusEvent(model, event.event_id));
    list.appendChild(item);
  }
}

function updateEventListHighlight(state) {
  const items = document.querySelectorAll(".event-item");
  items.forEach((el) => {
    const eid = el.dataset.eventId;
    el.classList.toggle("active", state.highlightedNodeIds.has(eid));
  });
}

function renderNarratives(model, focusedEventId) {
  const el = document.getElementById("narrative-list");
  if (!focusedEventId) {
    el.textContent = "点击左侧事件后显示对应 narrative 全文";
    return;
  }
  const ns = (model.narrativesByEvent.get(focusedEventId) || []).sort((a, b) =>
    a.narrative_id.localeCompare(b.narrative_id),
  );
  if (!ns.length) {
    el.textContent = "该事件暂无 narrative";
    return;
  }
  el.innerHTML = ns
    .map(
      (n) => `
      <article class="narrative-card ${n.type}">
        <div class="meta">${n.narrative_id} · ${n.type} · ${n.source || ""} · ${n.date || ""}</div>
        <div class="content">${n.content || ""}</div>
      </article>`,
    )
    .join("");
}

async function main() {
  const bundle = await loadBundle();
  const model = buildGraphModel(bundle);
  const svg = document.getElementById("graph");
  const scrollWrap = document.querySelector(".scroll-wrap");

  function getViewport() {
    return {
      width: scrollWrap?.clientWidth || window.innerWidth,
      height: scrollWrap?.clientHeight || window.innerHeight,
    };
  }

  function renderAll(state) {
    const layout = computeLayout(model, getViewport());
    renderGraph(svg, model, layout, state.focusedEventId || null);
    applyHighlight(state);
    updateEventListHighlight(state);
    renderNarratives(model, state.focusedEventId || null);
  }

  renderEventList(model);
  bindInteractions(model);
  const st = getState();
  renderAll(st);
  subscribe((st) => {
    renderAll(st);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      renderAll(getState());
      resizeTimer = null;
    }, 100);
  });
}

main().catch((err) => {
  const detail = document.getElementById("detail");
  detail.textContent = `加载失败: ${err.message}`;
  console.error(err);
});

