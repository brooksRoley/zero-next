import { useRef, useState, useCallback, useEffect } from "react";
import Head from "next/head";
import { NBA_TEAMS } from "src/lib/nba/teams-static";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

export default function NbaExplorer() {
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const [apiMap] = useState<Record<string, NodeDef>>(FALLBACK_MAP);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [responseData, setResponseData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [showJson, setShowJson] = useState(false);
  const [chartData, setChartData] = useState<AnyRow[] | null>(null);
  const [chartMetrics, setChartMetrics] = useState<string[]>([]);
  const [activeMetric, setActiveMetric] = useState("");

  // Camera state (refs to avoid re-renders on drag)
  const cam = useRef({ x: 0, y: 0, zoom: 1 });
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const hoveredNode = useRef<string | null>(null);

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
      ctx.fillText((max - (range * i) / 4).toFixed(1), pad.l - 6, y + 3);
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
    ctx.fillText(metric.toUpperCase(), pad.l, H - 4);
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
    try {
      const res = await fetch(url);
      const json = await res.json();
      setRawResponse(json);
      const data = json.data;
      setResponseData(data);

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
        const metric = numKeys[0] || "";
        setActiveMetric(metric);
        setTimeout(() => drawChart(chartable!, metric, nodeKey), 50);
      } else {
        setChartData(null);
        setChartMetrics([]);
      }
    } catch {
      setRawResponse({ error: "Failed to fetch" });
      setResponseData(null);
      setChartData(null);
    }
    setLoading(false);
  }, [apiMap, drawChart]);

  // ── Navigate ───────────────────────────────────────────────────────────────
  const navigateTo = useCallback((nodeKey: string) => {
    setActiveNode(nodeKey);
    setTrail((prev) => {
      const idx = prev.indexOf(nodeKey);
      return idx >= 0 ? prev.slice(0, idx + 1) : [...prev, nodeKey];
    });
    setResponseData(null);
    setRawResponse(null);
    setChartData(null);
    setShowJson(false);
    setParamValues({});
    drawGraph(nodeKey);

    // Auto-fetch if no required params
    const node = apiMap[nodeKey];
    if (node?.endpoint && !(node.params || []).some((p) => p.required)) {
      setTimeout(() => fetchEndpoint(nodeKey, {}), 0);
    }
  }, [apiMap, drawGraph, fetchEndpoint]);

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

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    drawGraph();
    const handleResize = () => drawGraph();
    window.addEventListener("resize", handleResize);
    // Auto-load last night's games so the panel shows real data immediately
    navigateTo("last_night");
    return () => window.removeEventListener("resize", handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Table helpers ──────────────────────────────────────────────────────────
  const tableCols = responseData && Array.isArray(responseData) && responseData.length
    ? Object.keys(responseData[0]).filter((k) => { const v = responseData[0][k]; return typeof v !== "object" || v === null; })
    : [];

  const nestedArrays: { key: string; arr: AnyRow[] }[] =
    responseData && !Array.isArray(responseData)
      ? Object.entries(responseData)
          .filter(([, v]) => Array.isArray(v) && (v as AnyRow[]).length > 0)
          .map(([key, arr]) => ({ key, arr: arr as AnyRow[] }))
      : [];

  const flatCols = (arr: AnyRow[]) =>
    arr.length ? Object.keys(arr[0]).filter((k) => typeof arr[0][k] !== "object" || arr[0][k] === null) : [];

  const flatObject = (obj: AnyRow) => {
    const flat: AnyRow = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "object" || v === null) flat[k] = v;
    }
    return flat;
  };

  const drillInto = (row: AnyRow) => {
    if (row.id === undefined || !activeNode) return;
    const node = apiMap[activeNode];
    if (!node?.children?.length) return;
    navigateTo(node.children[0]);
    setTimeout(() => setParamValues({ id: String(row.id) }), 0);
  };

  const activeNodeDef = activeNode ? apiMap[activeNode] : null;

  return (
    <>
      <Head>
        <title>NBA API Explorer | Brooks Roley</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;500;700;900&display=swap" rel="stylesheet" />
      </Head>

      <style jsx global>{`
        .nba-app * { margin: 0; padding: 0; box-sizing: border-box; }
        .nba-app {
          --bg: #0a0c10; --surface: #12151c; --surface2: #1a1e28; --border: #252a36;
          --text: #e2e4e9; --text2: #8b8fa3; --accent: #f97316; --accent2: #fb923c;
          font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text);
        }
        .nba-shell { display: grid; grid-template-columns: 1fr 420px; grid-template-rows: 56px 1fr; height: 100vh; }
        .nba-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; padding: 0 24px; background: var(--surface); border-bottom: 1px solid var(--border); z-index: 10; min-height: 56px; }
        .nba-header .logo { font-weight: 900; font-size: 18px; letter-spacing: -0.5px; color: var(--accent); }
        .nba-header .logo span { color: var(--text2); font-weight: 300; }
        .nba-pill { font-family: 'DM Mono', monospace; font-size: 11px; padding: 3px 10px; border-radius: 999px; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); }
        .nba-pill.live { border-color: #22c55e; color: #22c55e; }
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
        .nba-table th { text-align: left; padding: 6px 8px; font-family: 'DM Mono', monospace; font-size: 10px; color: var(--text2); border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; background: var(--surface); }
        .nba-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text); }
        .nba-table tr { cursor: pointer; transition: background 0.1s; }
        .nba-table tr:hover { background: rgba(249,115,22,0.06); }
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
        @media (max-width: 768px) {
          .nba-shell { grid-template-columns: 1fr; grid-template-rows: 56px 300px 1fr; }
        }
      `}</style>

      <div className="nba-app">
        <div className="nba-shell">
          <header className="nba-header">
            <div>
              <div className="logo">NBA<span>EXPLORER</span></div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2, fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}>
                Live stats, standings &amp; analytics — sourced from stats.nba.com
              </div>
            </div>
            <div className="nba-pill live">LIVE DATA</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "var(--text2)", fontFamily: "'DM Mono', monospace" }}>
              click nodes · drag to pan
            </div>
          </header>

          <div className="nba-canvas-wrap">
            <canvas
              ref={graphCanvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onClick={onCanvasClick}
              onWheel={onWheel}
            />
            <div className="nba-canvas-overlay">
              <button onClick={() => { cam.current = { x: 0, y: 0, zoom: 1 }; drawGraph(); }}>Reset View</button>
              <button onClick={() => { cam.current = { x: 0, y: 0, zoom: 0.85 }; drawGraph(); }}>Fit Graph</button>
            </div>
          </div>

          <div className="nba-panel">
            <div className="nba-panel-header">
              <h2>{activeNodeDef?.label ?? "API Explorer"}</h2>
              {activeNodeDef?.endpoint && <span className="nba-endpoint-tag">{activeNodeDef.endpoint}</span>}
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
                          <span>{p.name === "team_id" ? "team" : p.name}</span>
                          {p.name === "team_id" ? (
                            <select
                              value={paramValues[p.name] || ""}
                              onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                              style={{ flex: 1, padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontFamily: "'DM Mono', monospace", fontSize: 12, outline: "none" }}
                            >
                              <option value="">All teams{p.optional ? " (optional)" : ""}</option>
                              {NBA_TEAMS.sort((a, b) => a.full_name.localeCompare(b.full_name)).map((t) => (
                                <option key={t.id} value={String(t.id)}>{t.full_name}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={paramValues[p.name] || ""}
                              onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))}
                              placeholder={p.type + (p.optional ? " (optional)" : "")}
                            />
                          )}
                        </div>
                      ))}
                      <button
                        className="nba-fetch-btn"
                        disabled={loading}
                        onClick={() => fetchEndpoint(activeNode, paramValues)}
                      >
                        {loading ? "FETCHING..." : "FETCH DATA"}
                      </button>
                    </div>
                  )}

                  {loading && <div className="nba-loading"><div className="nba-spinner" /> Fetching...</div>}

                  {/* Chart */}
                  {chartData && chartData.length > 1 && (
                    <div className="nba-chart-wrap">
                      <h3>Data Visualization</h3>
                      <div className="nba-chart-tabs">
                        {chartMetrics.map((m) => (
                          <button
                            key={m}
                            className={activeMetric === m ? "active" : ""}
                            onClick={() => { setActiveMetric(m); drawChart(chartData, m, activeNode); }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <canvas ref={chartCanvasRef} width={360} height={180} style={{ cursor: "default", borderRadius: 4 }} />
                    </div>
                  )}

                  {/* Data Table (flat array) */}
                  {responseData && Array.isArray(responseData) && responseData.length > 0 && (
                    <table className="nba-table">
                      <thead>
                        <tr>{tableCols.map((col) => <th key={col}>{col}</th>)}</tr>
                      </thead>
                      <tbody>
                        {responseData.map((row: AnyRow, i: number) => (
                          <tr key={i} onClick={() => drillInto(row)}>
                            {tableCols.map((col) => (
                              <td key={col} className={typeof row[col] === "number" ? "num" : ""}>{row[col]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Single object */}
                  {responseData && !Array.isArray(responseData) && typeof responseData === "object" && (
                    <>
                      {Object.keys(flatObject(responseData)).length > 0 && (
                        <table className="nba-table">
                          <tbody>
                            {Object.entries(flatObject(responseData)).map(([key, val]) => (
                              <tr key={key}>
                                <td style={{ color: "var(--text2)" }}>{key}</td>
                                <td className={typeof val === "number" ? "num" : ""}>{String(val)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Nested arrays (analytics endpoints) */}
                  {nestedArrays.map(({ key, arr }) => (
                    <div key={key} style={{ marginBottom: 18 }}>
                      <div className="nba-section-label">
                        {key.replace(/_/g, " ")} <span style={{ color: "var(--border)" }}>({arr.length})</span>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table className="nba-table">
                          <thead>
                            <tr>{flatCols(arr).map((col) => <th key={col}>{col}</th>)}</tr>
                          </thead>
                          <tbody>
                            {arr.map((row, i) => (
                              <tr key={i} onClick={() => row.id !== undefined && drillInto(row)}>
                                {flatCols(arr).map((col) => (
                                  <td key={col} className={typeof row[col] === "number" ? "num" : ""}>{row[col]}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
