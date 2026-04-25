import { useRef, useState, useCallback, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { NBA_TEAMS } from "src/lib/nba/teams-static";
import { currentNbaSeason } from "src/lib/nba/season";

// ── API Map (fallback, also fetched from /api/nba/map) ──────────────────────
type NodeDef = {
  label: string;
  description: string;
  endpoint?: string;
  children: string[];
  params?: { name: string; type: string; required?: boolean; optional?: boolean }[];
};

const FALLBACK_MAP: Record<string, NodeDef> = {
  root: { label: "NBA Explorer", description: "Live NBA data — pick a category to start.", children: ["teams", "players", "standings", "games", "analytics"] },
  teams: { label: "Teams", description: "Browse all 30 NBA teams.", children: ["team_detail"], endpoint: "/api/nba/teams", params: [] },
  players: { label: "Players", description: "All active players with per-game stats. Filter by team.", children: ["player_detail"], endpoint: "/api/nba/players", params: [{ name: "team_id", type: "int", optional: true }] },
  standings: { label: "Standings", description: "Where does every team stand right now?", children: [], endpoint: "/api/nba/standings", params: [{ name: "conference", type: "str", optional: true }] },
  games: { label: "Recent Games", description: "What games happened recently?", children: ["game_detail"], endpoint: "/api/nba/games", params: [{ name: "date", type: "str", optional: true }] },
  team_detail: { label: "Team Profile", description: "Roster and info for a specific team.", children: ["players"], endpoint: "/api/nba/teams/{id}", params: [{ name: "id", type: "int", required: true }] },
  player_detail: { label: "Player Profile", description: "Stats, height, position, and averages for any player.", children: ["game_log"], endpoint: "/api/nba/players/{id}", params: [{ name: "id", type: "int", required: true }] },
  game_log: { label: "Game History", description: "How has a player been performing game by game?", children: [], endpoint: "/api/nba/players/{id}/gamelog", params: [{ name: "id", type: "int", required: true }, { name: "n", type: "int", optional: true }] },
  game_detail: { label: "Box Score", description: "Full box score for a specific game.", children: ["player_detail"], endpoint: "/api/nba/games/{id}", params: [{ name: "id", type: "int", required: true }] },
  analytics: { label: "Analytics Hub", description: "Dig into what's happening across the season.", children: ["last_night", "season_analytics", "team_dashboard", "lakers_dashboard"] },
  last_night: { label: "Last Night's Games", description: "Scores and top performers from last night.", children: [], endpoint: "/api/nba/analytics/last-night", params: [] },
  season_analytics: { label: "Season Leaders", description: "Who's dominating TS%, net rating, and usage this season?", children: [], endpoint: "/api/nba/analytics/season", params: [] },
  team_dashboard: { label: "Team Dashboard", description: "Record, roster advanced stats, and recent games for any team.", children: [], endpoint: "/api/nba/analytics/team/{id}", params: [{ name: "id", type: "int", required: true }] },
  lakers_dashboard: { label: "Lakers Dashboard", description: "How are the Lakers doing right now?", children: [], endpoint: "/api/nba/analytics/lakers", params: [] },
};

// ── Node layout positions (hand-tuned radial) ────────────────────────────────
const NODE_POSITIONS: Record<string, { x: number; y: number }> = (() => {
  const cx = 480, cy = 280;
  return {
    root: { x: cx, y: cy },
    teams: { x: cx - 220, y: cy - 160 },
    players: { x: cx + 220, y: cy - 160 },
    standings: { x: cx - 280, y: cy + 100 },
    games: { x: cx + 280, y: cy + 100 },
    team_detail: { x: cx - 340, y: cy - 40 },
    player_detail: { x: cx + 100, y: cy - 20 },
    game_log: { x: cx + 100, y: cy + 120 },
    game_detail: { x: cx + 360, y: cy },
    analytics: { x: cx, y: cy + 200 },
    last_night: { x: cx - 280, y: cy + 330 },
    season_analytics: { x: cx - 100, y: cy + 390 },
    team_dashboard: { x: cx + 100, y: cy + 390 },
    lakers_dashboard: { x: cx + 280, y: cy + 330 },
  };
})();

const NODE_COLORS: Record<string, string> = {
  root: "#f97316", teams: "#3b82f6", players: "#22c55e", standings: "#a855f7",
  games: "#ef4444", team_detail: "#3b82f6", player_detail: "#22c55e",
  game_log: "#06b6d4", game_detail: "#ef4444", analytics: "#f59e0b",
  last_night: "#fb923c", season_analytics: "#fbbf24", team_dashboard: "#34d399",
  lakers_dashboard: "#a78bfa",
};

const COL_LABELS: Record<string, string> = {
  // Stats
  ts_pct: "True Shooting %", usg_pct: "Usage %", pie: "Player Impact",
  net_rating: "Net Rating", efg_pct: "Effective FG%", ast_pct: "Assist %",
  reb_pct: "Rebound %", oreb_pct: "Off Reb %", dreb_pct: "Def Reb %",
  off_rating: "Off Rating", def_rating: "Def Rating", pace: "Pace",
  ppg: "PPG", rpg: "RPG", apg: "APG", spg: "SPG", bpg: "BPG",
  fg_pct: "FG%", fg3_pct: "3PT%", ft_pct: "FT%",
  pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals",
  blk: "Blocks", tov: "Turnovers", plus_minus: "+/-",
  wins: "Wins", losses: "Losses", min: "Minutes",
  // Player / team fields
  id: "ID", name: "Name", team_id: "Team", team_name: "Team", player_id: "Player",
  city: "City", abbrev: "Abbrev", conference: "Conf", division: "Division",
  pos: "Pos", jersey: "Jersey", height: "Height", weight: "Weight", country: "Country",
  // Game fields
  game_id: "Game ID", date: "Date", home_team: "Home", away_team: "Away",
  home_score: "Home Pts", away_score: "Away Pts", winner: "Winner",
  // Season / standings
  rank: "Rank", record: "Record", pct: "Win %", streak: "Streak",
  last10: "Last 10", home_record: "Home", away_record: "Away",
};
// Alias — chart tabs use this subset
const METRIC_LABELS = COL_LABELS;

const colLabel = (key: string): string =>
  COL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Friendly placeholder text per param name — avoids leaking raw type strings
const PARAM_PLACEHOLDERS: Record<string, string> = {
  id: "e.g. 2544",
  team_id: "e.g. 1610612747",
  date: "e.g. 2024-01-15",
  n: "Last N games",
  conference: "East or West",
};

// Leaf nodes require a param (ID) from a parent — shown greyed on mobile until parent visited
const MOBILE_LEAF_NODES = new Set(["team_detail", "player_detail", "game_log", "game_detail"]);

const MOBILE_GROUPS = [
  { label: "Browse", nodes: ["teams", "players", "standings", "games", "team_detail", "player_detail", "game_log", "game_detail"] },
  { label: "Analytics", nodes: ["last_night", "season_analytics", "team_dashboard", "lakers_dashboard"] },
];

// Preferred chart metric per node — falls back to first numeric key if not present in data
const PREFERRED_METRIC: Record<string, string> = {
  players: "ppg",
  player_detail: "ppg",
  game_log: "pts",
  teams: "wins",
  standings: "wins",
  season_analytics: "net_rating",
  team_dashboard: "net_rating",
  lakers_dashboard: "net_rating",
  last_night: "home_score",
  game_detail: "pts",
};

const CHART_TITLE: Record<string, string> = {
  players: "Player Averages",
  player_detail: "Player Stats",
  game_log: "Game-by-Game",
  teams: "Team Records",
  standings: "Team Records",
  season_analytics: "Season Leaders",
  team_dashboard: "Roster Stats",
  lakers_dashboard: "Roster Stats",
  last_night: "Last Night's Scores",
  game_detail: "Box Score",
};

type AnyRow = Record<string, any>;

export default function NbaExplorer() {
  const router = useRouter();
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const [apiMap] = useState<Record<string, NodeDef>>(FALLBACK_MAP);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [responseData, setResponseData] = useState<any>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [showJson, setShowJson] = useState(false);
  const [chartData, setChartData] = useState<AnyRow[] | null>(null);
  const [chartMetrics, setChartMetrics] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeMetric, setActiveMetric] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0); // drives "X min ago" re-renders

  // Camera state (refs to avoid re-renders on drag)
  const cam = useRef({ x: 0, y: 0, zoom: 1 });
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const hoveredNode = useRef<string | null>(null);
  const focusedNode = useRef<string | null>(null);

  // Stable node order for keyboard nav: top-to-bottom, left-to-right
  const NODE_ORDER = Object.entries(NODE_POSITIONS)
    .sort(([, a], [, b]) => a.y !== b.y ? a.y - b.y : a.x - b.x)
    .map(([key]) => key);

  // ── Graph Drawing ──────────────────────────────────────────────────────────
  const drawGraph = useCallback((activeKey: string | null = activeNode) => {
    const canvas = graphCanvasRef.current;
    if (!canvas?.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const c = cam.current;
    ctx.save();
    ctx.translate(c.x + rect.width / 2, c.y + rect.height / 2);
    ctx.scale(c.zoom, c.zoom);
    ctx.translate(-480, -320);

    // Edges
    for (const [key, node] of Object.entries(apiMap)) {
      if (!node.children) continue;
      const from = NODE_POSITIONS[key];
      if (!from) continue;
      for (const child of node.children) {
        const to = NODE_POSITIONS[child];
        if (!to) continue;
        const isHighlighted = activeKey === key || activeKey === child;
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2 - 20;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.strokeStyle = isHighlighted ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.06)";
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
        ctx.fillStyle = isHighlighted ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.08)";
        ctx.fill();
      }
    }

    // Nodes
    const R = 36;
    for (const [key, pos] of Object.entries(NODE_POSITIONS)) {
      const isActive = activeKey === key;
      const isHovered = hoveredNode.current === key;
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
      if (focusedNode.current === key) {
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
  }, [apiMap, activeNode]);

  // ── Hit Test ───────────────────────────────────────────────────────────────
  const hitTest = useCallback((mx: number, my: number) => {
    const canvas = graphCanvasRef.current;
    if (!canvas?.parentElement) return null;
    const rect = canvas.parentElement.getBoundingClientRect();
    const c = cam.current;
    const wx = (mx - c.x - rect.width / 2) / c.zoom + 480;
    const wy = (my - c.y - rect.height / 2) / c.zoom + 320;
    for (const [key, pos] of Object.entries(NODE_POSITIONS)) {
      const dx = wx - pos.x, dy = wy - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) return key;
    }
    return null;
  }, []);

  // ── Chart Drawing ──────────────────────────────────────────────────────────
  const drawChart = useCallback((data: AnyRow[], metric: string, nodeKey: string | null) => {
    const canvas = chartCanvasRef.current;
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
    const color = NODE_COLORS[nodeKey ?? ""] || "#f97316";

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
  }, []);

  // ── Fetch Endpoint ─────────────────────────────────────────────────────────
  const fetchEndpoint = useCallback(async (nodeKey: string, params: Record<string, string>) => {
    const node = apiMap[nodeKey];
    if (!node?.endpoint) return;

    let url = node.endpoint;
    for (const p of node.params || []) {
      if (params[p.name]) url = url.replace(`{${p.name}}`, params[p.name]);
    }
    const qp = new URLSearchParams();
    for (const p of node.params || []) {
      if (params[p.name] && !node.endpoint.includes(`{${p.name}}`)) {
        qp.set(p.name, params[p.name]);
      }
    }
    const qs = qp.toString();
    if (qs) url += "?" + qs;

    setLoading(true);
    setFetchError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const json = await res.json();
      setRawResponse(json);
      const data = json.data;
      setResponseData(data);
      setFetchedAt(new Date());

      // Detect chartable data
      let chartable: AnyRow[] | null = Array.isArray(data) && data.length > 1 ? data : null;
      if (!chartable && data && typeof data === "object" && !Array.isArray(data)) {
        const firstArr = Object.values(data).find(
          (v) => Array.isArray(v) && v.length > 1 && typeof (v as AnyRow[])[0] === "object"
        ) as AnyRow[] | undefined;
        if (firstArr) chartable = firstArr;
      }
      if (chartable) {
        const numKeys = Object.keys(chartable[0]).filter((k) => typeof chartable![0][k] === "number");
        setChartMetrics(numKeys);
        setChartData(chartable);
        const preferred = PREFERRED_METRIC[nodeKey];
        const metric = (preferred && numKeys.includes(preferred)) ? preferred : (numKeys[0] || "");
        setActiveMetric(metric);
        setTimeout(() => drawChart(chartable!, metric, nodeKey), 50);
      } else {
        setChartData(null);
        setChartMetrics([]);
      }
    } catch (e) {
      clearTimeout(timeout);
      const isTimeout = e instanceof Error && e.name === "AbortError";
      setFetchError(isTimeout
        ? "NBA's API is slow today — try again in a moment."
        : "Couldn't reach the NBA API. Check your connection and try again.");
      setRawResponse(null);
      setResponseData(null);
      setChartData(null);
    }
    setLoading(false);
  }, [apiMap, drawChart]);

  // ── Navigate ───────────────────────────────────────────────────────────────
  const navigateTo = useCallback((nodeKey: string, { updateUrl = true } = {}) => {
    setActiveNode(nodeKey);
    setTrail((prev) => {
      const idx = prev.indexOf(nodeKey);
      return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, nodeKey];
    });
    setResponseData(null);
    setRawResponse(null);
    setChartData(null);
    setShowJson(false);
    setFetchError(null);
    setSortCol(null);
    setTableSearch("");
    setFetchedAt(null);
    setParamValues({});
    drawGraph(nodeKey);

    if (updateUrl) {
      router.push({ pathname: "/nba", query: { node: nodeKey } }, undefined, { shallow: true });
    }

    // Auto-fetch if no required params
    const node = apiMap[nodeKey];
    if (node?.endpoint && !(node.params || []).some((p) => p.required)) {
      setTimeout(() => fetchEndpoint(nodeKey, {}), 0);
    }
  }, [apiMap, drawGraph, fetchEndpoint, router]);

  // ── Canvas Events ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragState.current = { dragging: true, startX: e.nativeEvent.offsetX, startY: e.nativeEvent.offsetY, camStartX: cam.current.x, camStartY: cam.current.y };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ds = dragState.current;
    if (ds.dragging) {
      cam.current.x = ds.camStartX + (e.nativeEvent.offsetX - ds.startX);
      cam.current.y = ds.camStartY + (e.nativeEvent.offsetY - ds.startY);
      drawGraph();
    } else {
      const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (hit !== hoveredNode.current) {
        hoveredNode.current = hit;
        const canvas = graphCanvasRef.current;
        if (canvas) canvas.style.cursor = hit ? "pointer" : "grab";
        drawGraph();
      }
    }
  }, [drawGraph, hitTest]);

  const onMouseUp = useCallback(() => { dragState.current.dragging = false; }, []);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ds = dragState.current;
    if (Math.abs(e.nativeEvent.offsetX - ds.startX) > 5 || Math.abs(e.nativeEvent.offsetY - ds.startY) > 5) return;
    const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (hit) navigateTo(hit);
  }, [hitTest, navigateTo]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    cam.current.zoom = Math.max(0.3, Math.min(3, cam.current.zoom * delta));
    drawGraph();
  }, [drawGraph]);

  const onCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const current = focusedNode.current;
    const idx = current ? NODE_ORDER.indexOf(current) : -1;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (current) navigateTo(current);
      return;
    }
    if (e.key === "Escape") {
      focusedNode.current = null;
      drawGraph();
      return;
    }

    // Directional: find nearest node in pressed direction
    const pos = current ? NODE_POSITIONS[current] : null;
    if (e.key === "Tab") {
      e.preventDefault();
      const next = e.shiftKey
        ? NODE_ORDER[(idx <= 0 ? NODE_ORDER.length : idx) - 1]
        : NODE_ORDER[(idx + 1) % NODE_ORDER.length];
      focusedNode.current = next;
      drawGraph();
      return;
    }
    if (pos && (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      let best: string | null = null;
      let bestScore = Infinity;
      for (const [key, p] of Object.entries(NODE_POSITIONS)) {
        if (key === current) continue;
        const dx = p.x - pos.x, dy = p.y - pos.y;
        const inDir =
          e.key === "ArrowRight" ? dx > 20 :
          e.key === "ArrowLeft"  ? dx < -20 :
          e.key === "ArrowDown"  ? dy > 20 :
                                   dy < -20;
        if (!inDir) continue;
        // Score: distance penalised for being off-axis
        const primary = Math.abs(e.key === "ArrowRight" || e.key === "ArrowLeft" ? dx : dy);
        const secondary = Math.abs(e.key === "ArrowRight" || e.key === "ArrowLeft" ? dy : dx);
        const score = primary + secondary * 2;
        if (score < bestScore) { bestScore = score; best = key; }
      }
      if (!best) {
        // wrap: use Tab order
        focusedNode.current = e.key === "ArrowRight" || e.key === "ArrowDown"
          ? NODE_ORDER[(idx + 1) % NODE_ORDER.length]
          : NODE_ORDER[(idx <= 0 ? NODE_ORDER.length : idx) - 1];
      } else {
        focusedNode.current = best;
      }
      drawGraph();
    }
  }, [NODE_ORDER, drawGraph, navigateTo]);

  const onCanvasFocus = useCallback(() => {
    if (!focusedNode.current) {
      focusedNode.current = activeNode ?? NODE_ORDER[0];
      drawGraph();
    }
  }, [NODE_ORDER, activeNode, drawGraph]);

  const onCanvasBlur = useCallback(() => {
    focusedNode.current = null;
    drawGraph();
  }, [drawGraph]);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    if (!localStorage.getItem("nba-onboarded")) setShowOnboarding(true);
    // Auto-fit zoom: graph content spans ~760px wide, scale to 85% of available canvas width
    const canvasEl = graphCanvasRef.current;
    if (canvasEl?.parentElement) {
      const availW = canvasEl.parentElement.getBoundingClientRect().width;
      cam.current.zoom = Math.max(0.5, Math.min(1, (availW * 0.85) / 760));
    }
    drawGraph();
    const handleResize = () => { checkMobile(); drawGraph(); };
    window.addEventListener("resize", handleResize);
    const initialNode = typeof router.query.node === "string" && apiMap[router.query.node]
      ? router.query.node
      : "last_night";
    navigateTo(initialNode, { updateUrl: false });
    const ticker = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { window.removeEventListener("resize", handleResize); clearInterval(ticker); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync URL → node on browser back/forward ────────────────────────────────
  useEffect(() => {
    const node = typeof router.query.node === "string" ? router.query.node : null;
    if (node && apiMap[node] && node !== activeNode) {
      navigateTo(node, { updateUrl: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.node]);

  // ── Table helpers ──────────────────────────────────────────────────────────
  const tableCols = responseData && Array.isArray(responseData) && responseData.length
    ? Object.keys(responseData[0]).filter((k) => { const v = responseData[0][k]; return !HIDDEN_COLS.has(k) && (typeof v !== "object" || v === null); })
    : [];

  const nestedArrays: { key: string; arr: AnyRow[] }[] =
    responseData && !Array.isArray(responseData)
      ? Object.entries(responseData)
          .filter(([, v]) => Array.isArray(v) && (v as AnyRow[]).length > 0)
          .map(([key, arr]) => ({ key, arr: arr as AnyRow[] }))
      : [];

  const flatCols = (arr: AnyRow[]) =>
    arr.length ? Object.keys(arr[0]).filter((k) => !HIDDEN_COLS.has(k) && (typeof arr[0][k] !== "object" || arr[0][k] === null)) : [];

  const flatObject = (obj: AnyRow) => {
    const flat: AnyRow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "object" || v === null) flat[k] = v;
    }
    return flat;
  };

  const formatCell = (col: string, val: unknown): string => {
    if (typeof val === "number") {
      if (col.endsWith("_pct") || col.endsWith("_percentage")) return (val * 100).toFixed(1) + "%";
      if (Number.isInteger(val) && Math.abs(val) >= 1000) return val.toLocaleString();
      if (!Number.isInteger(val)) return val.toFixed(1);
    }
    return String(val ?? "");
  };

  const canDrill = (row: AnyRow): boolean => {
    if (row.id === undefined || !activeNode) return false;
    return !!(apiMap[activeNode]?.children?.length);
  };

  const drillInto = (row: AnyRow) => {
    if (!canDrill(row)) return;
    const node = apiMap[activeNode!];
    navigateTo(node.children[0]);
    setTimeout(() => setParamValues({ id: String(row.id) }), 0);
  };

  const timeAgo = (date: Date): string => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const PLAYER_NODES = new Set(["players", "player_detail", "game_log"]);
  // Columns retained internally (for drilldown, avatars) but never shown to users
  const HIDDEN_COLS = new Set(["id", "team_id", "player_id", "game_id"]);

  const filterRows = (rows: AnyRow[]): AnyRow[] => {
    if (!tableSearch.trim()) return rows;
    const q = tableSearch.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) => typeof v === "string" && v.toLowerCase().includes(q))
    );
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sortRows = (rows: AnyRow[]) => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av === bv) return 0;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const activeNodeDef = activeNode ? apiMap[activeNode] : null;

  return (
    <>
      <Head>
        <title>NBA API Explorer | Brooks Roley</title>
      </Head>

      <style jsx global>{`
        .nba-app * { margin: 0; padding: 0; box-sizing: border-box; }
        .nba-app {
          --bg: #0a0c10; --surface: #12151c; --surface2: #1a1e28; --border: #252a36;
          --text: #e2e4e9; --text2: #8b8fa3; --accent: #f97316; --accent2: #fb923c;
          font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text);
        }
        .nba-shell { display: grid; grid-template-columns: 1fr clamp(360px, 28vw, 520px); grid-template-rows: 56px 1fr; height: 100vh; }
        .nba-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; padding: 0 24px; background: var(--surface); border-bottom: 1px solid var(--border); z-index: 10; min-height: 56px; }
        .nba-header .logo { font-weight: 900; font-size: 18px; letter-spacing: -0.5px; color: var(--accent); }
        .nba-header .logo span { color: var(--text2); font-weight: 300; }
        .nba-pill { font-family: 'DM Mono', monospace; font-size: 11px; padding: 3px 10px; border-radius: 999px; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); }
        .nba-canvas-wrap { position: relative; overflow: hidden; background: radial-gradient(circle at 30% 40%, rgba(249,115,22,0.04) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(59,130,246,0.03) 0%, transparent 50%), var(--bg); }
        .nba-canvas-wrap canvas { display: block; width: 100%; height: 100%; cursor: grab; }
        .nba-canvas-overlay { position: absolute; bottom: 16px; left: 16px; display: flex; gap: 8px; }
        .nba-canvas-overlay button { font-family: 'DM Mono', monospace; font-size: 12px; padding: 6px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; color: var(--text2); cursor: pointer; }
        .nba-canvas-overlay button:hover { background: var(--surface2); color: var(--text); border-color: var(--accent); }
        .nba-panel { background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
        .nba-panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
        .nba-panel-header h2 { font-size: 14px; font-weight: 700; }
        .nba-endpoint-tag { font-family: 'DM Mono', monospace; font-size: 11px; padding: 2px 8px; background: rgba(249,115,22,0.12); color: var(--accent); border-radius: 4px; }
        .nba-panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .nba-breadcrumb { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px; font-family: 'DM Mono', monospace; font-size: 11px; }
        .nba-crumb { padding: 2px 8px; background: var(--surface2); border-radius: 4px; color: var(--text2); cursor: pointer; }
        .nba-crumb:hover { color: var(--accent); }
        .nba-crumb.active { background: rgba(249,115,22,0.15); color: var(--accent); }
        .nba-params { margin-bottom: 16px; padding: 12px; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border); }
        .nba-params label { display: block; font-size: 11px; font-family: 'DM Mono', monospace; color: var(--text2); margin-bottom: 6px; }
        .nba-param-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .nba-param-row span { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--accent); min-width: 70px; }
        .nba-param-row input { flex: 1; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family: 'DM Mono', monospace; font-size: 12px; outline: none; }
        .nba-param-row input:focus { border-color: var(--accent); }
        .nba-fetch-btn { width: 100%; padding: 8px; background: var(--accent); border: none; border-radius: 6px; color: #fff; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; letter-spacing: 0.5px; }
        .nba-fetch-btn:hover { background: var(--accent2); }
        .nba-fetch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .nba-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        .nba-table th { text-align: left; padding: 6px 8px; font-family: 'DM Mono', monospace; font-size: 10px; color: var(--text2); border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; background: var(--surface); cursor: pointer; user-select: none; white-space: nowrap; }
        .nba-table th:hover { color: var(--accent); }
        .nba-table th.sorted { color: var(--accent); }
        .nba-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text); }
        .nba-table tr { transition: background 0.1s; }
        .nba-table tr[data-drillable]:hover { background: rgba(249,115,22,0.06); }
        .nba-table .num { text-align: right; color: #06b6d4; }
        .nba-chart-wrap { margin-bottom: 16px; padding: 12px; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border); }
        .nba-chart-wrap h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); margin-bottom: 10px; }
        .nba-chart-tabs { display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap; }
        .nba-chart-tabs button { font-family: 'DM Mono', monospace; font-size: 10px; padding: 3px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text2); cursor: pointer; }
        .nba-chart-tabs button.active { border-color: var(--accent); color: var(--accent); background: rgba(249,115,22,0.1); }
        .nba-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text2); gap: 12px; }
        .nba-empty .icon { font-size: 48px; opacity: 0.3; }
        .nba-empty p { font-size: 13px; max-width: 240px; line-height: 1.5; }
        .nba-spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: nba-spin 0.6s linear infinite; display: inline-block; }
        @keyframes nba-spin { to { transform: rotate(360deg); } }
        .nba-loading { display: flex; align-items: center; gap: 8px; padding: 16px; color: var(--text2); font-size: 12px; }
        .nba-json-toggle { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text2); cursor: pointer; padding: 8px 0; user-select: none; }
        .nba-json-toggle:hover { color: var(--accent); }
        .nba-json-block { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-family: 'DM Mono', monospace; font-size: 11px; line-height: 1.5; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; color: var(--text2); margin-top: 8px; }
        .nba-child-btn { font-family: 'DM Mono', monospace; font-size: 12px; padding: 6px 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; }
        .nba-child-btn:hover { border-color: var(--accent); color: var(--accent); }
        .nba-section-label { font-family: 'DM Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); margin-bottom: 8px; }
        .nba-search { width: 100%; padding: 7px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-family: 'DM Mono', monospace; font-size: 12px; outline: none; margin-bottom: 10px; }
        .nba-search:focus { border-color: var(--accent); }
        .nba-freshness { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text2); margin-left: auto; }
        .nba-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; background: var(--surface2); vertical-align: middle; }
        .nba-avatar-cell { width: 36px; padding: 4px 8px; }
        @media (max-width: 768px) {
          .nba-shell { grid-template-columns: 1fr; grid-template-rows: 56px 300px 1fr; }
        }
      `}</style>

      <div className="nba-app">
        <div className="nba-shell">
          <header className="nba-header">
            <Link href="/" style={{ textDecoration: "none" }}>
              <div className="logo">NBA<span>EXPLORER</span></div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2, fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}>
                Live stats, standings &amp; analytics — sourced from stats.nba.com
              </div>
            </Link>
            <div className="nba-pill">{currentNbaSeason()} Season</div>
            <div style={{ flex: 1 }} />
            <a
              href="https://github.com/brooksRoley/zero-next"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text2)", fontFamily: "'DM Mono', monospace", textDecoration: "none" }}
              aria-label="View source on GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
              Source
            </a>
          </header>

          {isMobile ? (
            <div style={{ overflowY: "auto", background: "var(--bg)", padding: "12px 16px" }}>
              {MOBILE_GROUPS.map((group) => (
                <div key={group.label} style={{ marginBottom: 20 }}>
                  <div className="nba-section-label" style={{ marginBottom: 10 }}>{group.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {group.nodes.map((key) => {
                      const node = apiMap[key];
                      if (!node) return null;
                      const isLeaf = MOBILE_LEAF_NODES.has(key);
                      const isVisited = trail.includes(key);
                      const dimmed = isLeaf && !isVisited;
                      return (
                        <button
                          key={key}
                          className="nba-child-btn"
                          disabled={dimmed}
                          style={{
                            textAlign: "left", padding: "10px 14px",
                            opacity: dimmed ? 0.4 : 1,
                            borderColor: activeNode === key ? "var(--accent)" : undefined,
                            color: activeNode === key ? "var(--accent)" : undefined,
                            cursor: dimmed ? "default" : "pointer",
                          }}
                          onClick={() => !dimmed && navigateTo(key)}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{node.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                            {dimmed ? "Select a row above to drill in" : node.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="nba-canvas-wrap">
              <canvas
                ref={graphCanvasRef}
                tabIndex={0}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onClick={onCanvasClick}
                onWheel={onWheel}
                onKeyDown={onCanvasKeyDown}
                onFocus={onCanvasFocus}
                onBlur={onCanvasBlur}
                style={{ outline: "none" }}
              />
              <div className="nba-canvas-overlay">
                <button onClick={() => { cam.current = { x: 0, y: 0, zoom: 1 }; drawGraph(); }}>Reset View</button>
                <button onClick={() => { cam.current = { x: 0, y: 0, zoom: 0.85 }; drawGraph(); }}>Fit Graph</button>
              </div>

              {showOnboarding && (
                <div style={{
                  position: "absolute", inset: 0, background: "rgba(10,12,16,0.85)",
                  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20,
                }}>
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: "28px 32px", maxWidth: 340, textAlign: "center",
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🏀</div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Welcome to NBA Explorer</div>
                    <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 20 }}>
                      Each circle is a live API endpoint. Click a node to explore its data,
                      drag to pan the graph, and scroll to zoom.
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16, fontSize: 12, color: "var(--text2)", fontFamily: "'DM Mono', monospace" }}>
                      <span style={{ padding: "4px 10px", background: "var(--surface2)", borderRadius: 4 }}>🖱 click node</span>
                      <span style={{ padding: "4px 10px", background: "var(--surface2)", borderRadius: 4 }}>✋ drag to pan</span>
                      <span style={{ padding: "4px 10px", background: "var(--surface2)", borderRadius: 4 }}>⚲ scroll to zoom</span>
                    </div>
                    <button
                      className="nba-fetch-btn"
                      onClick={() => {
                        localStorage.setItem("nba-onboarded", "1");
                        setShowOnboarding(false);
                      }}
                    >
                      Got it — explore
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="nba-panel">
            <div className="nba-panel-header">
              <h2>{activeNodeDef?.label ?? "API Explorer"}</h2>
              {activeNodeDef?.endpoint && <span className="nba-endpoint-tag">{activeNodeDef.endpoint}</span>}
              {fetchedAt && <span className="nba-freshness">{timeAgo(fetchedAt)}</span>}
            </div>
            <div className="nba-panel-body">
              {!activeNode ? (
                <div className="nba-empty">
                  <div className="icon">🏀</div>
                  <p>Click a node on the graph to explore NBA API endpoints and visualize data</p>
                </div>
              ) : (
                <>
                  {/* Breadcrumb */}
                  {trail.length > 0 && (
                    <div className="nba-breadcrumb">
                      {trail.map((crumb, i) => (
                        <span key={crumb}>
                          <span
                            className={`nba-crumb${i === trail.length - 1 ? " active" : ""}`}
                            onClick={() => navigateTo(crumb)}
                          >
                            {apiMap[crumb]?.label}
                          </span>
                          {i < trail.length - 1 && <span style={{ color: "var(--border)", margin: "0 2px" }}>›</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>{activeNodeDef?.description}</p>

                  {/* Params + Fetch */}
                  {activeNodeDef?.endpoint && (
                    <div className="nba-params">
                      {(activeNodeDef.params || []).length > 0 && <label>PARAMETERS</label>}
                      {(activeNodeDef.params || []).map((p) => (
                        <div key={p.name} className="nba-param-row">
                          <span>{p.name === "team_id" ? "Team" : p.name === "conference" ? "Conf" : colLabel(p.name)}</span>
                          {p.name === "team_id" ? (
                            <select
                              value={paramValues[p.name] || ""}
                              onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                              style={{ flex: 1, padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontFamily: "'DM Mono', monospace", fontSize: 12, outline: "none" }}
                            >
                              <option value="">All teams</option>
                              {NBA_TEAMS.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((t) => (
                                <option key={t.id} value={String(t.id)}>{t.full_name}</option>
                              ))}
                            </select>
                          ) : p.name === "conference" ? (
                            <select
                              value={paramValues[p.name] || ""}
                              onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                              style={{ flex: 1, padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontFamily: "'DM Mono', monospace", fontSize: 12, outline: "none" }}
                            >
                              <option value="">All conferences</option>
                              <option value="East">East</option>
                              <option value="West">West</option>
                            </select>
                          ) : (
                            <input
                              value={paramValues[p.name] || ""}
                              onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter" && !loading) fetchEndpoint(activeNode!, paramValues); }}
                              placeholder={PARAM_PLACEHOLDERS[p.name] ?? (p.optional ? "optional" : "required")}
                            />
                          )}
                        </div>
                      ))}
                      <button
                        className="nba-fetch-btn"
                        disabled={loading}
                        onClick={() => fetchEndpoint(activeNode, paramValues)}
                      >
                        {loading ? "Loading..." : "Fetch Data →"}
                      </button>
                    </div>
                  )}

                  {loading && <div className="nba-loading"><div className="nba-spinner" /> Fetching from stats.nba.com...</div>}

                  {fetchError && (
                    <div style={{ padding: "14px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 14 }}>
                      <div style={{ fontSize: 13, color: "#f87171", fontWeight: 600, marginBottom: 4 }}>Data unavailable</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>{fetchError}</div>
                    </div>
                  )}

                  {/* Chart */}
                  {chartData && chartData.length > 1 && (
                    <div className="nba-chart-wrap">
                      <h3>{activeNode ? (CHART_TITLE[activeNode] ?? activeNodeDef?.label ?? "Chart") : "Chart"}</h3>
                      <div className="nba-chart-tabs">
                        {chartMetrics.map((m) => (
                          <button
                            key={m}
                            className={activeMetric === m ? "active" : ""}
                            onClick={() => { setActiveMetric(m); drawChart(chartData, m, activeNode); }}
                          >
                            {METRIC_LABELS[m] ?? m}
                          </button>
                        ))}
                      </div>
                      <canvas ref={chartCanvasRef} width={360} height={180} style={{ cursor: "default", borderRadius: 4 }} />
                    </div>
                  )}

                  {/* Data Table (flat array) */}
                  {responseData && Array.isArray(responseData) && responseData.length > 0 && (() => {
                    const showAvatars = PLAYER_NODES.has(activeNode ?? "");
                    const filtered = filterRows(sortRows(responseData));
                    return (
                      <>
                        {responseData.length > 8 && (
                          <input
                            className="nba-search"
                            placeholder="Filter by name..."
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                          />
                        )}
                        <table className="nba-table">
                          <thead>
                            <tr>
                              {showAvatars && <th className="nba-avatar-cell" />}
                              {tableCols.map((col) => (
                                <th key={col} className={sortCol === col ? "sorted" : ""} onClick={() => handleSort(col)}>
                                  {colLabel(col)}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((row: AnyRow, i: number) => (
                              <tr key={i} onClick={() => drillInto(row)} style={{ cursor: canDrill(row) ? "pointer" : "default" }} data-drillable={canDrill(row) ? "" : undefined}>
                                {showAvatars && (
                                  <td className="nba-avatar-cell">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      className="nba-avatar"
                                      src={`https://cdn.nba.com/headshots/nba/latest/260x190/${row.id}.png`}
                                      alt=""
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  </td>
                                )}
                                {tableCols.map((col) => (
                                  <td key={col} className={typeof row[col] === "number" ? "num" : ""}>{formatCell(col, row[col])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {tableSearch && filtered.length === 0 && (
                          <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text2)", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                            No results for &ldquo;{tableSearch}&rdquo;
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Single object */}
                  {responseData && !Array.isArray(responseData) && typeof responseData === "object" && (
                    <>
                      {Object.keys(flatObject(responseData)).length > 0 && (
                        <table className="nba-table">
                          <tbody>
                            {Object.entries(flatObject(responseData)).map(([key, val]) => (
                              <tr key={key}>
                                <td style={{ color: "var(--text2)" }}>{colLabel(key)}</td>
                                <td className={typeof val === "number" ? "num" : ""}>{formatCell(key, val)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Nested arrays (analytics endpoints) */}
                  {nestedArrays.map(({ key, arr }) => {
                    const filteredArr = filterRows(sortRows(arr));
                    return (
                    <div key={key} style={{ marginBottom: 18 }}>
                      <div className="nba-section-label">
                        {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} <span style={{ color: "var(--border)" }}>({arr.length})</span>
                      </div>
                      {arr.length > 8 && (
                        <input
                          className="nba-search"
                          placeholder="Filter by name..."
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                        />
                      )}
                      <div style={{ overflowX: "auto" }}>
                        <table className="nba-table">
                          <thead>
                            <tr>{flatCols(arr).map((col) => (
                              <th key={col} className={sortCol === col ? "sorted" : ""} onClick={() => handleSort(col)}>
                                {colLabel(col)}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                              </th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {filteredArr.map((row, i) => (
                              <tr key={i} onClick={() => drillInto(row)} style={{ cursor: canDrill(row) ? "pointer" : "default" }} data-drillable={canDrill(row) ? "" : undefined}>
                                {flatCols(arr).map((col) => (
                                  <td key={col} className={typeof row[col] === "number" ? "num" : ""}>{formatCell(col, row[col])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })}

                  {/* Raw JSON toggle */}
                  {rawResponse && (
                    <>
                      <div className="nba-json-toggle" onClick={() => setShowJson(!showJson)}>
                        {showJson ? "▾ Hide" : "▸ Show"} Raw JSON
                      </div>
                      {showJson && <div className="nba-json-block">{JSON.stringify(rawResponse, null, 2)}</div>}
                    </>
                  )}

                  {/* Children links */}
                  {activeNodeDef?.children && activeNodeDef.children.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <label className="nba-section-label">NAVIGATE TO</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {activeNodeDef.children.map((child) => (
                          <button key={child} className="nba-child-btn" onClick={() => navigateTo(child)}>
                            {apiMap[child]?.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {rawResponse && (
                    <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text2)", fontFamily: "'DM Mono', monospace" }}>
                      via stats.nba.com
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
