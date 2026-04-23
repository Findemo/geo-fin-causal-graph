function shortText(text, max = 20) {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function conciseEventLabel(event) {
  const summary = String(event.summary || "").trim();
  const title = String(event.title || "").trim();
  const source = summary || title;
  const cut = source.split(/[，。；,.]/)[0].trim();
  return shortText(cut || source || event.event_id, 12);
}

function normalizeStep(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildGraphModel(bundle) {
  const nodes = [];
  const nodeById = new Map();

  const narrativesByEvent = new Map();
  for (const n of bundle.narratives) {
    if (!narrativesByEvent.has(n.event_id)) narrativesByEvent.set(n.event_id, []);
    narrativesByEvent.get(n.event_id).push(n);
  }

  const chainByEvent = new Map();
  for (const c of bundle.marketChains) {
    chainByEvent.set(c.event_id, c);
  }

  const eventsOrdered = [...bundle.events].sort((a, b) => {
    const da = String(a.datetime || "").slice(0, 10);
    const db = String(b.datetime || "").slice(0, 10);
    if (da !== db) return da.localeCompare(db);
    return a.event_id.localeCompare(b.event_id);
  });
  const eventIds = eventsOrdered.map((e) => e.event_id);

  for (const e of bundle.events) {
    const node = {
      id: e.event_id,
      layer: "event",
      label: conciseEventLabel(e),
      data: e,
      event_id: e.event_id,
    };
    nodes.push(node);
    nodeById.set(node.id, node);
  }

  for (const n of bundle.narratives) {
    const node = {
      id: n.narrative_id,
      layer: n.type === "prediction" ? "prediction" : "report",
      label: shortText(n.content, 18),
      data: n,
      event_id: n.event_id,
    };
    nodes.push(node);
    nodeById.set(node.id, node);
  }

  const marketNodeByKey = new Map();
  const marketNodeFreq = new Map();
  const eventToMarketPath = new Map();
  const marketToEventIds = new Map();
  let marketSeq = 1;
  for (const chain of bundle.marketChains) {
    const stepNodeIds = [];
    for (const step of chain.chain_steps) {
      const key = normalizeStep(step.text);
      if (!marketNodeByKey.has(key)) {
        const marketId = `MK${String(marketSeq).padStart(3, "0")}`;
        marketSeq += 1;
        const node = {
          id: marketId,
          layer: "market",
          label: shortText(step.text, 18),
          data: { text: step.text, normalized_key: key },
          event_id: null,
        };
        nodes.push(node);
        nodeById.set(node.id, node);
        marketNodeByKey.set(key, marketId);
        marketNodeFreq.set(marketId, 0);
      }
      const sharedId = marketNodeByKey.get(key);
      marketNodeFreq.set(sharedId, (marketNodeFreq.get(sharedId) || 0) + 1);
      stepNodeIds.push(sharedId);
      if (!marketToEventIds.has(sharedId)) marketToEventIds.set(sharedId, new Set());
      marketToEventIds.get(sharedId).add(chain.event_id);
    }
    eventToMarketPath.set(chain.event_id, stepNodeIds);
  }

  const marketNodeIds = nodes
    .filter((n) => n.layer === "market")
    .sort((a, b) => (marketNodeFreq.get(b.id) || 0) - (marketNodeFreq.get(a.id) || 0))
    .map((n) => n.id);

  return {
    nodes,
    nodeById,
    eventIds,
    eventsOrdered,
    narrativesByEvent,
    chainByEvent,
    eventToMarketPath,
    marketToEventIds,
    marketNodeIds,
  };
}

