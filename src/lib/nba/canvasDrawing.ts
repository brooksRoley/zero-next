// Canvas rendering for the NBA API Explorer (src/pages/nba.tsx): the
// physics-graph court view and the per-endpoint stat chart. Extracted out of
// the page component as plain functions of their inputs — nothing here reads
// component state directly, so it can be tested and reasoned about without a
// React render.

import { NODE_POSITIONS, NODE_COLORS, METRIC_LABELS, type NodeDef, type AnyRow } from "./explorerConfig";

type Camera = { x: number; y: number; zoom: number };

export function drawExplorerGraph(opts: {
  canvas: HTMLCanvasElement | null;
  cam: Camera;
  apiMap: Record<string, NodeDef>;
  physPos: (key: string) => { x: number; y: number };
  hoveredNode: string | null;
  focusedNode: string | null;
  activeKey: string | null;
}): void {
  const { canvas, cam, apiMap, physPos, hoveredNode, focusedNode, activeKey } = opts;
  if (!canvas?.parentElement) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const c = cam;
  ctx.save();
  ctx.translate(c.x + rect.width / 2, c.y + rect.height / 2);
  ctx.scale(c.zoom, c.zoom);
  ctx.translate(-480, -320);

  // ── Court (world space, beneath everything) ──────────────────────────────
  // Stylized full court: hardwood wash, boundary, half-court line, center
  // circle, keys + free-throw circles, hoops and three-point arcs. All
  // low-alpha so nodes and labels stay the loudest thing on the floor.
  {
    const court = { x: 70, y: 90, w: 820, h: 720 };
    const midY = court.y + court.h / 2;
    const courtCx = court.x + court.w / 2;
    // hardwood
    const wood = ctx.createLinearGradient(court.x, court.y, court.x + court.w, court.y + court.h);
    wood.addColorStop(0, "rgba(193,138,78,0.10)");
    wood.addColorStop(1, "rgba(146,97,52,0.05)");
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.roundRect(court.x, court.y, court.w, court.h, 18);
    ctx.fill();
    // plank seams
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    for (let px = court.x + 46; px < court.x + court.w; px += 46) {
      ctx.beginPath(); ctx.moveTo(px, court.y + 4); ctx.lineTo(px, court.y + court.h - 4); ctx.stroke();
    }
    // boundary + half-court line
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(court.x, court.y, court.w, court.h, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(court.x, midY); ctx.lineTo(court.x + court.w, midY); ctx.stroke();
    // center circle — NBA red inner, blue outer
    ctx.beginPath(); ctx.arc(courtCx, midY, 64, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(29,66,138,0.55)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(courtCx, midY, 26, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,16,46,0.16)"; ctx.fill();
    ctx.strokeStyle = "rgba(200,16,46,0.45)"; ctx.stroke();
    // keys, free-throw circles, hoops, 3pt arcs — top and bottom halves
    for (const end of [0, 1]) {
      const baseY = end === 0 ? court.y : court.y + court.h;
      const dir = end === 0 ? 1 : -1;
      const ftY = baseY + dir * 190;
      const hoopY = baseY + dir * 52;
      // key (paint)
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.fillStyle = "rgba(29,66,138,0.10)";
      ctx.beginPath();
      ctx.rect(courtCx - 80, Math.min(baseY, ftY), 160, Math.abs(ftY - baseY));
      ctx.fill(); ctx.stroke();
      // free-throw circle
      ctx.beginPath(); ctx.arc(courtCx, ftY, 60, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.stroke();
      // backboard + hoop
      ctx.strokeStyle = "rgba(255,255,255,0.20)";
      ctx.beginPath(); ctx.moveTo(courtCx - 30, baseY + dir * 40); ctx.lineTo(courtCx + 30, baseY + dir * 40); ctx.stroke();
      ctx.beginPath(); ctx.arc(courtCx, hoopY, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(200,16,46,0.6)"; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.lineWidth = 2;
      // three-point arc (clipped to the court)
      ctx.save();
      ctx.beginPath(); ctx.rect(court.x, court.y, court.w, court.h); ctx.clip();
      ctx.beginPath();
      ctx.arc(courtCx, hoopY, 258, end === 0 ? 0.09 * Math.PI : 1.09 * Math.PI, end === 0 ? 0.91 * Math.PI : 1.91 * Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.stroke();
      ctx.restore();
    }
  }

  // Edges
  for (const [key, node] of Object.entries(apiMap)) {
    if (!node.children) continue;
    const from = physPos(key);
    if (!from) continue;
    for (const child of node.children) {
      const to = physPos(child);
      if (!to) continue;
      const isHighlighted = activeKey === key || activeKey === child;
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2 - 20;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(mx, my, to.x, to.y);
      ctx.strokeStyle = isHighlighted ? "rgba(229,72,77,0.45)" : "rgba(255,255,255,0.06)";
      ctx.lineWidth = isHighlighted ? 2 : 1;
      ctx.stroke();
      // Arrow
      const angle = Math.atan2(to.y - my, to.x - mx);
      const ax = to.x - Math.cos(angle) * 42;
      const ay = to.y - Math.sin(angle) * 42;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4));
      ctx.lineTo(ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = isHighlighted ? "rgba(229,72,77,0.55)" : "rgba(255,255,255,0.08)";
      ctx.fill();
    }
  }

  // Nodes
  const R = 36;
  for (const key of Object.keys(NODE_POSITIONS)) {
    const pos = physPos(key);
    const isActive = activeKey === key;
    const isHovered = hoveredNode === key;
    const color = NODE_COLORS[key] || "#888";
    if (isActive || isHovered) {
      const grad = ctx.createRadialGradient(pos.x, pos.y, R * 0.5, pos.x, pos.y, R * 2.5);
      grad.addColorStop(0, color + "30");
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, R * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, R, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? color + "22" : "#12151c";
    ctx.fill();
    ctx.strokeStyle = isActive ? color : isHovered ? color + "aa" : "#252a36";
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y - 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = "500 12px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isActive ? "#fff" : "#8b8fa3";
    ctx.fillText(apiMap[key]?.label || key, pos.x, pos.y + 10);

    // Keyboard focus ring
    if (focusedNode === key) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, R + 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.restore();
}

export function drawExplorerChart(
  canvas: HTMLCanvasElement | null,
  data: AnyRow[],
  metric: string,
  nodeKey: string | null
): void {
  if (!canvas || !data?.length || !metric) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 360, H = 180;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const values = data.map((d) => d[metric]).filter((v): v is number => typeof v === "number");
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = { t: 10, r: 10, b: 30, l: 45 };
  const gw = W - pad.l - pad.r;
  const gh = H - pad.t - pad.b;
  const color = NODE_COLORS[nodeKey ?? ""] || "#e5484d";

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + gh * (i / 4);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.font = "10px monospace"; ctx.fillStyle = "#555"; ctx.textAlign = "right";
    const axisVal = max - (range * i) / 4;
    const axisLabel = (metric.endsWith("_pct") || metric.endsWith("_percentage"))
      ? (axisVal * 100).toFixed(1) + "%"
      : axisVal.toFixed(1);
    ctx.fillText(axisLabel, pad.l - 6, y + 3);
  }

  const isBar = values.length <= 15;
  if (isBar) {
    const gap = gw / values.length;
    const bw = Math.min(24, gap * 0.7);
    values.forEach((v, i) => {
      const x = pad.l + i * gap + gap / 2;
      const h = ((v - min) / range) * gh;
      const y = pad.t + gh - h;
      const grad = ctx.createLinearGradient(x, y, x, pad.t + gh);
      grad.addColorStop(0, color); grad.addColorStop(1, color + "33");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y, bw, h, [3, 3, 0, 0]);
      ctx.fill();
      ctx.font = "9px monospace"; ctx.fillStyle = "#555"; ctx.textAlign = "center";
      const label = data[i].name || data[i].abbrev || data[i].game || data[i].date || i + 1;
      ctx.fillText(String(label).substring(0, 6), x, H - pad.b + 14);
    });
  } else {
    const step = gw / (values.length - 1);
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + gh);
    values.forEach((v, i) => { ctx.lineTo(pad.l + i * step, pad.t + gh - ((v - min) / range) * gh); });
    ctx.lineTo(pad.l + (values.length - 1) * step, pad.t + gh);
    ctx.closePath(); ctx.fillStyle = color + "15"; ctx.fill();
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.l + i * step, y = pad.t + gh - ((v - min) / range) * gh;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(pad.l + i * step, pad.t + gh - ((v - min) / range) * gh, 3, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  }
  ctx.font = "500 11px sans-serif"; ctx.fillStyle = color; ctx.textAlign = "left";
  ctx.fillText((METRIC_LABELS[metric] ?? metric).toUpperCase(), pad.l, H - 4);
}
