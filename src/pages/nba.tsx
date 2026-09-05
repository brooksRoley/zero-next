import { useRef, useState, useCallback, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import { NBA_TEAMS } from "src/lib/nba/teams-static";
import { currentNbaSeason } from "src/lib/nba/season";
import PredictionCard, { type Prediction } from "src/components/PredictionCard";
import {
  type NodeDef,
  type AnyRow,
  FALLBACK_MAP,
  NODE_POSITIONS,
  METRIC_LABELS,
  colLabel,
  PARAM_PLACEHOLDERS,
  MOBILE_LEAF_NODES,
  MOBILE_GROUPS,
  PREFERRED_METRIC,
  CHART_TITLE,
} from "src/lib/nba/explorerConfig";
import { drawExplorerGraph, drawExplorerChart } from "src/lib/nba/canvasDrawing";

// Client-only viz panel — keeps the explorer's initial bundle lean
const LeagueLens = dynamic(() => import("src/components/nba/LeagueLens"), { ssr: false });

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
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<{
    totalPredictions: number;
    covers: number;
    misses: number;
    pushes: number;
    modelMae: number;
    vegasMae: number;
    beatVegas: number;
  } | null>(null);

  // Camera state (refs to avoid re-renders on drag)
  const cam = useRef({ x: 0, y: 0, zoom: 1 });
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const hoveredNode = useRef<string | null>(null);
  const focusedNode = useRef<string | null>(null);

  // Node physics: each node is a mass on a spring anchored at its layout
  // position — hover/activate give it a dribble impulse, an ambient sway
  // keeps the court alive. Positions live in a ref; the rAF loop redraws.
  const phys = useRef<Record<string, { x: number; y: number; vx: number; vy: number; phase: number }>>(
    Object.fromEntries(
      Object.entries(NODE_POSITIONS).map(([k, p], i) => [k, { x: p.x, y: p.y, vx: 0, vy: 0, phase: i * 1.7 }])
    )
  );
  const physPos = useCallback((key: string) => phys.current[key] ?? NODE_POSITIONS[key], []);
  const bounce = useCallback((key: string, strength: number) => {
    const n = phys.current[key];
    if (n) n.vy -= strength;
  }, []);

  // Stable node order for keyboard nav: top-to-bottom, left-to-right
  const NODE_ORDER = Object.entries(NODE_POSITIONS)
    .sort(([, a], [, b]) => a.y !== b.y ? a.y - b.y : a.x - b.x)
    .map(([key]) => key);

  // ── Graph Drawing ──────────────────────────────────────────────────────────
  const drawGraph = useCallback((activeKey: string | null = activeNode) => {
    drawExplorerGraph({
      canvas: graphCanvasRef.current,
      cam: cam.current,
      apiMap,
      physPos,
      hoveredNode: hoveredNode.current,
      focusedNode: focusedNode.current,
      activeKey,
    });
  }, [apiMap, activeNode, physPos]);

  // ── Node physics loop ──────────────────────────────────────────────────────
  // Underdamped springs give the hover/click impulses a dribble bounce; the
  // ambient sway keeps the court feeling alive at rest. rAF pauses with the
  // tab, and the whole scene is a dozen shapes — cheap to redraw.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 16.7, 3);
      last = now;
      for (const [key, home] of Object.entries(NODE_POSITIONS)) {
        const n = phys.current[key];
        if (!n) continue;
        n.vx += (home.x - n.x) * 0.02 * dt;
        n.vy += (home.y - n.y) * 0.02 * dt;
        const damp = 0.92 ** dt;
        n.vx *= damp;
        n.vy *= damp;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        n.x += Math.sin(now * 0.0006 + n.phase) * 0.06 * dt;
        n.y += Math.cos(now * 0.0005 + n.phase * 1.7) * 0.06 * dt;
      }
      drawGraph();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawGraph]);

  // ── Hit Test ───────────────────────────────────────────────────────────────
  const hitTest = useCallback((mx: number, my: number) => {
    const canvas = graphCanvasRef.current;
    if (!canvas?.parentElement) return null;
    const rect = canvas.parentElement.getBoundingClientRect();
    const c = cam.current;
    const wx = (mx - c.x - rect.width / 2) / c.zoom + 480;
    const wy = (my - c.y - rect.height / 2) / c.zoom + 320;
    for (const key of Object.keys(NODE_POSITIONS)) {
      const pos = physPos(key);
      const dx = wx - pos.x, dy = wy - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) return key;
    }
    return null;
  }, [physPos]);

  // ── Chart Drawing ──────────────────────────────────────────────────────────
  const drawChart = useCallback((data: AnyRow[], metric: string, nodeKey: string | null) => {
    drawExplorerChart(chartCanvasRef.current, data, metric, nodeKey);
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
        if (hit) bounce(hit, 2.2); // dribble tap on hover-in
        const canvas = graphCanvasRef.current;
        if (canvas) canvas.style.cursor = hit ? "pointer" : "grab";
        drawGraph();
      }
    }
  }, [drawGraph, hitTest, bounce]);

  const onMouseUp = useCallback(() => { dragState.current.dragging = false; }, []);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ds = dragState.current;
    if (Math.abs(e.nativeEvent.offsetX - ds.startX) > 5 || Math.abs(e.nativeEvent.offsetY - ds.startY) > 5) return;
    const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (hit) {
      bounce(hit, 6); // hard dribble on select
      navigateTo(hit);
    }
  }, [hitTest, navigateTo, bounce]);

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
    // Read the node from window.location, not router.query — on first render
    // the router hasn't hydrated the query yet, so deep links briefly resolved
    // to the fallback node, fetched it, and left its stale response rendered
    // under the real node once the URL→node sync caught up.
    const qNode = new URLSearchParams(window.location.search).get("node");
    const initialNode = qNode && apiMap[qNode] ? qNode : "last_night";
    navigateTo(initialNode, { updateUrl: false });
    const ticker = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { window.removeEventListener("resize", handleResize); clearInterval(ticker); };
  // Invariant: mount-only initialization. Including drawGraph/navigateTo/apiMap/router
  // would re-run init on every render whose callbacks change identity — re-attaching
  // the resize listener and re-firing navigateTo (which pushes router state, which
  // changes navigateTo's identity), producing a loop. The URL → node sync below
  // handles subsequent navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch today's predictions ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nba/predictions/today");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPredictionsError(json?.error || "Couldn't load predictions");
          setPredictions([]);
        } else {
          setPredictions(Array.isArray(json.data) ? (json.data as Prediction[]) : []);
        }
      } catch {
        if (!cancelled) {
          setPredictionsError("Couldn't load predictions");
          setPredictions([]);
        }
      } finally {
        if (!cancelled) setPredictionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Fetch model accuracy (settled predictions) ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nba/predictions/accuracy");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json?.data) setAccuracy(json.data);
      } catch {
        /* non-fatal */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Sync URL → node on browser back/forward ────────────────────────────────
  useEffect(() => {
    const node = typeof router.query.node === "string" ? router.query.node : null;
    if (node && apiMap[node] && node !== activeNode) {
      navigateTo(node, { updateUrl: false });
    }
  }, [router.query.node, apiMap, activeNode, navigateTo]);

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
          /* NBA brand: red/blue chrome (light steps for text on dark), solid red for fills */
          --text: #e2e4e9; --text2: #8b8fa3; --accent: #e5484d; --accent2: #3987e5; --accent-solid: #C8102E;
          font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--text);
        }
        .nba-shell { display: grid; grid-template-columns: 1fr clamp(360px, 28vw, 520px); grid-template-rows: 56px auto 1fr; height: 100vh; }
        .nba-picks { grid-column: 1 / -1; background: var(--bg); border-bottom: 1px solid var(--border); padding: 12px 20px; }
        .nba-picks-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .nba-picks-title { font-family: 'Anton', 'Outfit', sans-serif; font-size: 13px; font-weight: 400; text-transform: uppercase; letter-spacing: 2px; color: var(--accent); }
        .nba-picks-sub { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text2); }
        .nba-picks-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .nba-picks-empty { font-size: 12px; color: var(--text2); font-family: 'DM Mono', monospace; padding: 4px 0; }
        .nba-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 16px; padding: 0 24px; background: var(--surface); border-bottom: 1px solid var(--border); z-index: 10; min-height: 56px; }
        .nba-header .logo { font-family: 'Anton', 'Outfit', sans-serif; font-weight: 400; font-size: 19px; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); }
        .nba-header .logo span { color: var(--text2); font-weight: 300; }
        .nba-pill { font-family: 'DM Mono', monospace; font-size: 11px; padding: 3px 10px; border-radius: 999px; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); }
        .nba-canvas-wrap { position: relative; overflow: hidden; background: radial-gradient(circle at 30% 40%, rgba(200,16,46,0.05) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(29,66,138,0.06) 0%, transparent 50%), var(--bg); }
        .nba-canvas-wrap canvas { display: block; width: 100%; height: 100%; cursor: grab; }
        .nba-canvas-overlay { position: absolute; bottom: 16px; left: 16px; display: flex; gap: 8px; }
        .nba-canvas-overlay button { font-family: 'DM Mono', monospace; font-size: 12px; padding: 6px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; color: var(--text2); cursor: pointer; }
        .nba-canvas-overlay button:hover { background: var(--surface2); color: var(--text); border-color: var(--accent); }
        .nba-panel { background: var(--surface); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
        .nba-panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
        .nba-panel-header h2 { font-family: 'Anton', 'Outfit', sans-serif; font-size: 15px; font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase; }
        .nba-endpoint-tag { font-family: 'DM Mono', monospace; font-size: 11px; padding: 2px 8px; background: rgba(200,16,46,0.14); color: var(--accent); border-radius: 4px; }
        .nba-panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .nba-breadcrumb { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px; font-family: 'DM Mono', monospace; font-size: 11px; }
        .nba-crumb { padding: 2px 8px; background: var(--surface2); border-radius: 4px; color: var(--text2); cursor: pointer; }
        .nba-crumb:hover { color: var(--accent); }
        .nba-crumb.active { background: rgba(200,16,46,0.16); color: var(--accent); }
        .nba-params { margin-bottom: 16px; padding: 12px; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border); }
        .nba-params label { display: block; font-size: 11px; font-family: 'DM Mono', monospace; color: var(--text2); margin-bottom: 6px; }
        .nba-param-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .nba-param-row span { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--accent); min-width: 70px; }
        .nba-param-row input { flex: 1; padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-family: 'DM Mono', monospace; font-size: 12px; outline: none; }
        .nba-param-row input:focus { border-color: var(--accent); }
        .nba-fetch-btn { width: 100%; padding: 8px; background: var(--accent-solid); border: none; border-radius: 6px; color: #fff; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; letter-spacing: 0.5px; }
        .nba-fetch-btn:hover { background: var(--accent); }
        .nba-fetch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .nba-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
        .nba-table th { text-align: left; padding: 6px 8px; font-family: 'DM Mono', monospace; font-size: 10px; color: var(--text2); border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; background: var(--surface); cursor: pointer; user-select: none; white-space: nowrap; }
        .nba-table th:hover { color: var(--accent); }
        .nba-table th.sorted { color: var(--accent); }
        .nba-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text); }
        .nba-table tr { transition: background 0.1s; }
        .nba-table tr[data-drillable]:hover { background: rgba(200,16,46,0.08); }
        .nba-table .num { text-align: right; color: #06b6d4; }
        .nba-chart-wrap { margin-bottom: 16px; padding: 12px; background: var(--surface2); border-radius: 8px; border: 1px solid var(--border); }
        .nba-chart-wrap h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); margin-bottom: 10px; }
        .nba-chart-tabs { display: flex; gap: 4px; margin-bottom: 10px; flex-wrap: wrap; }
        .nba-chart-tabs button { font-family: 'DM Mono', monospace; font-size: 10px; padding: 3px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text2); cursor: pointer; }
        .nba-chart-tabs button.active { border-color: var(--accent); color: var(--accent); background: rgba(200,16,46,0.12); }
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
          .nba-shell { grid-template-columns: 1fr; grid-template-rows: 56px auto 300px 1fr; }
        }
      `}</style>

      <div className="nba-app">
        <div className="nba-shell">
          <header className="nba-header">
            <Link href="/" style={{ textDecoration: "none" }}>
              <div className="logo">NBA<span>EXPLORER</span></div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2, fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}>
                Live stats, standings &amp; analytics — ESPN-fed data pipeline, refreshed daily
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

          <section className="nba-picks" aria-label="Today's Picks">
            <div className="nba-picks-header">
              <span className="nba-picks-title">Today&apos;s Picks</span>
              <span className="nba-picks-sub">
                {predictionsLoading
                  ? "loading..."
                  : predictions && predictions.length > 0
                    ? `${predictions.length} game${predictions.length === 1 ? "" : "s"} · ranked by edge`
                    : ""}
              </span>
              {accuracy && accuracy.totalPredictions > 0 && (
                <span
                  className="nba-picks-sub"
                  title={`Across ${accuracy.totalPredictions} settled prediction${accuracy.totalPredictions === 1 ? "" : "s"}`}
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    ATS{" "}
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                      {accuracy.covers}-{accuracy.misses}
                      {accuracy.pushes > 0 ? `-${accuracy.pushes}` : ""}
                    </span>
                  </span>
                  <span>
                    Model MAE{" "}
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{accuracy.modelMae.toFixed(2)}</span>
                  </span>
                  <span>
                    Vegas MAE{" "}
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{accuracy.vegasMae.toFixed(2)}</span>
                  </span>
                  <span>
                    Beats Vegas{" "}
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                      {accuracy.beatVegas}/{accuracy.totalPredictions}
                    </span>
                  </span>
                </span>
              )}
            </div>
            {predictionsLoading ? (
              <div className="nba-loading"><div className="nba-spinner" /> Loading today&apos;s model picks…</div>
            ) : predictionsError ? (
              <div className="nba-picks-empty">{predictionsError}</div>
            ) : predictions && predictions.length > 0 ? (
              <div className="nba-picks-scroll">
                {predictions.map((p) => (
                  <PredictionCard key={`${p.event_id}-${p.created_at ?? ""}`} p={p} />
                ))}
              </div>
            ) : (
              <div className="nba-picks-empty">
                No picks generated in the last 24 hours. Run the simulator to populate today&apos;s slate.
              </div>
            )}
          </section>

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

                  {/* League Lens — self-contained viz panel, no generic fetcher */}
                  {activeNode === "league_lens" && <LeagueLens />}

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

                  {loading && <div className="nba-loading"><div className="nba-spinner" /> Fetching...</div>}

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
                      via the site&apos;s ESPN-fed data pipeline
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
