const MIN_SVG_WIDTH = 1200;
const MAX_SVG_WIDTH = 3200;
const MIN_SVG_HEIGHT = 980;
const MAX_SVG_HEIGHT = 2400;
const TIMELINE_TOP_Y = 110;
const TIMELINE_ROW_GAP = 72;
const NARRATIVE_Y = 500;
const NARRATIVE_GAP = 74;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function computeLayout(model, viewport = {}) {
  const viewportWidth = Number(viewport.width) || MIN_SVG_WIDTH;
  const viewportHeight = Number(viewport.height) || MIN_SVG_HEIGHT;
  const SVG_WIDTH = clamp(Math.round(viewportWidth * 1.35), MIN_SVG_WIDTH, MAX_SVG_WIDTH);
  const SVG_HEIGHT = clamp(Math.round(viewportHeight * 1.5), MIN_SVG_HEIGHT, MAX_SVG_HEIGHT);
  const margin = clamp(Math.round(SVG_WIDTH * 0.12), 140, 360);
  const LEFT_MARGIN = margin;
  const RIGHT_MARGIN = margin;
  const MARKET_DISC_CX = SVG_WIDTH / 2;
  const MARKET_DISC_CY = clamp(Math.round(SVG_HEIGHT * 0.47), 520, 980);
  const MARKET_DISC_RX = clamp(Math.round(SVG_WIDTH * 0.42), 470, 1400);
  const MARKET_DISC_RY = clamp(Math.round(SVG_HEIGHT * 0.36), 280, 820);

  const positions = new Map();
  const events = model.eventsOrdered;
  const n = events.length || 1;
  const usableW = SVG_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  const rows = Math.min(5, Math.max(4, Math.ceil(n / 8)));
  const rowSize = Math.ceil(n / rows);
  const timelinePoints = [];
  const timelineTicks = [];

  events.forEach((event, idx) => {
    const row = Math.floor(idx / rowSize);
    const col = idx % rowSize;
    const rowCount = Math.min(rowSize, n - row * rowSize);
    const t = rowCount <= 1 ? 0.5 : col / (rowCount - 1);
    const sx = LEFT_MARGIN + t * usableW;
    const ex = row % 2 === 0 ? sx : LEFT_MARGIN + usableW - t * usableW; // S-shape
    const ey = TIMELINE_TOP_Y + row * TIMELINE_ROW_GAP;
    positions.set(event.event_id, { x: ex, y: ey, w: 104, h: 32 });
    timelinePoints.push({ x: ex, y: ey });
    if (col === 0 || col === rowCount - 1) {
      timelineTicks.push({
        x: ex,
        y: ey - 28,
        text: String(event.datetime || "").slice(0, 10),
      });
    }
  });

  for (const event of events) {
    const eid = event.event_id;
    const ePos = positions.get(eid);
    const narratives = (model.narrativesByEvent.get(eid) || []).sort((a, b) => a.narrative_id.localeCompare(b.narrative_id));
    narratives.forEach((narrative, i) => {
      positions.set(narrative.narrative_id, {
        x: ePos.x,
        y: NARRATIVE_Y + i * NARRATIVE_GAP,
        w: 118,
        h: 36,
      });
    });
  }

  const marketIds = model.marketNodeIds;
  const m = marketIds.length || 1;
  const placed = [];
  marketIds.forEach((id, idx) => {
    // Golden-angle scatter in ellipse for better dispersion
    const r = Math.sqrt((idx + 0.5) / m);
    const theta = idx * GOLDEN_ANGLE;
    let x = MARKET_DISC_CX + MARKET_DISC_RX * 0.88 * r * Math.cos(theta);
    let y = MARKET_DISC_CY + MARKET_DISC_RY * 0.88 * r * Math.sin(theta);

    // lightweight collision relaxation
    for (let k = 0; k < 45; k++) {
      let moved = false;
      for (const p of placed) {
        const dx = x - p.x;
        const dy = y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 104) {
          x += (dx / d) * 8;
          y += (dy / d) * 6;
          moved = true;
        }
      }
      const nx = (x - MARKET_DISC_CX) / (MARKET_DISC_RX * 0.93);
      const ny = (y - MARKET_DISC_CY) / (MARKET_DISC_RY * 0.93);
      const norm = nx * nx + ny * ny;
      if (norm > 1) {
        const s = 1 / Math.sqrt(norm);
        x = MARKET_DISC_CX + (x - MARKET_DISC_CX) * s;
        y = MARKET_DISC_CY + (y - MARKET_DISC_CY) * s;
      }
      if (!moved) break;
    }

    placed.push({ x, y });
    positions.set(id, { x, y, w: 122, h: 34 });
  });

  return {
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
    positions,
    timelinePoints,
    timelineTicks,
    marketDisc: {
      cx: MARKET_DISC_CX,
      cy: MARKET_DISC_CY,
      rx: MARKET_DISC_RX,
      ry: MARKET_DISC_RY,
    },
  };
}

export function edgePath(layout, edge) {
  const a = layout.positions.get(edge.source);
  const b = layout.positions.get(edge.target);
  if (!a || !b) return "";
  const x1 = a.x;
  const y1 = a.y;
  const x2 = b.x;
  const y2 = b.y;
  const c1x = x1;
  const c1y = y1 + (y2 - y1) * 0.45;
  const c2x = x2;
  const c2y = y2 - (y2 - y1) * 0.45;
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

