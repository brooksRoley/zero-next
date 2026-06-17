import { useState, useRef, useCallback, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  AI_MODELS,
  getModelById,
  getModelsGroupedByProvider,
  type AIModel,
} from "src/lib/ai-providers/models";

/* ── Types ── */
type StoredKeys = {
  openrouter?: string;
  groq?: string;
  cerebras?: string;
};

type StreamColumn = {
  modelId: string;
  content: string;
  ttft: number | null;
  totalTime: number | null;
  tokenEstimate: number;
  status: "idle" | "streaming" | "done" | "error";
  error?: string;
};

type BattleRecord = {
  modelA: string;
  modelB: string;
  winner: "a" | "b" | "tie";
  prompt: string;
  timestamp: number;
};

/* ── BYOK helpers (shared with chat) ── */
function loadStoredKeys(): StoredKeys {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("ai-provider-keys") || "{}");
  } catch {
    return {};
  }
}

function saveStoredKeys(keys: StoredKeys) {
  localStorage.setItem("ai-provider-keys", JSON.stringify(keys));
}

function loadBattleHistory(): BattleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("arena-battles") || "[]");
  } catch {
    return [];
  }
}

function saveBattleHistory(records: BattleRecord[]) {
  localStorage.setItem("arena-battles", JSON.stringify(records));
}

/* ── Free-tier daily limit (email capture) ── */
const FREE_DAILY_BATTLES = 10;
const EMAIL_BONUS_BATTLES = 10;

function todayStamp(): string {
  // Local-date YYYY-MM-DD so the counter resets at the user's local midnight.
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

const usageKey = () => `model_arena_battles_${todayStamp()}`;
const unlockKey = () => `model_arena_unlocked_${todayStamp()}`;

function loadUsage(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(usageKey());
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveUsage(count: number) {
  localStorage.setItem(usageKey(), String(count));
}

function loadUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(unlockKey()) === "1";
}

function saveUnlocked() {
  localStorage.setItem(unlockKey(), "1");
}

/* ── Email Gate Modal ── */
function EmailGate({
  onUnlock,
  onUseKeys,
  onClose,
}: {
  onUnlock: () => void;
  onUseKeys: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const handleSubmit = async () => {
    if (!valid || status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "/tools/model-arena",
          event_type: "model_arena_email_gate",
          metadata: { email: email.trim() },
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      saveUnlocked();
      onUnlock();
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#C5E7EA]/20 bg-[#1c2426] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#DADBD9]">
          You&apos;ve hit today&apos;s free limit
        </h2>
        <p className="mt-2 text-sm text-[#DADBD9]/60">
          That&apos;s {FREE_DAILY_BATTLES} free runs on the house. Drop your email
          to unlock {EMAIL_BONUS_BATTLES} more today — or bring your own API key
          for unlimited runs.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-[#C5E7EA]/30 bg-[#415557]/40 px-3 py-2 text-sm text-[#DADBD9] placeholder-[#DADBD9]/40 focus:border-[#C5E7EA]/70 focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!valid || status === "submitting"}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/30 text-[#C5E7EA] hover:bg-[#C5E7EA]/40 transition-colors disabled:opacity-40"
          >
            {status === "submitting" ? "…" : "Unlock"}
          </button>
        </div>
        {status === "error" && (
          <p className="mt-2 text-xs text-red-400/80">
            Something went wrong — try again or use your own key.
          </p>
        )}

        <button
          onClick={onUseKeys}
          className="mt-4 w-full px-3 py-2 rounded-lg text-sm text-[#DADBD9]/70 hover:text-[#DADBD9] border border-[#C5E7EA]/20 hover:bg-[#415557]/30 transition-colors"
        >
          Use my own API key instead
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full text-xs text-[#DADBD9]/40 hover:text-[#DADBD9]/70 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

/* ── BYOK Panel ── */
function BYOKPanel({
  keys,
  onUpdate,
  openRef,
}: {
  keys: StoredKeys;
  onUpdate: (keys: StoredKeys) => void;
  openRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (openRef) openRef.current = () => setOpen(true);
  }, [openRef]);
  const [local, setLocal] = useState<StoredKeys>(keys);

  const providers = [
    { id: "openrouter" as const, name: "OpenRouter" },
    { id: "groq" as const, name: "Groq" },
    { id: "cerebras" as const, name: "Cerebras" },
  ];

  const handleSave = () => {
    saveStoredKeys(local);
    onUpdate(local);
  };

  const handleClear = (id: keyof StoredKeys) => {
    const next = { ...local };
    delete next[id];
    setLocal(next);
    saveStoredKeys(next);
    onUpdate(next);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 rounded-lg text-sm text-[#DADBD9]/70 hover:text-[#DADBD9] border border-[#C5E7EA]/20 hover:bg-[#415557]/30 transition-colors"
      >
        API Keys
        {Object.values(keys).some(Boolean) && (
          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#C5E7EA]/20 bg-[#1c2426] p-4 shadow-2xl z-50">
          <p className="text-xs text-[#DADBD9]/50 mb-3">
            Keys are stored in your browser only and sent directly to the
            provider.
          </p>
          {providers.map((p) => (
            <label key={p.id} className="block mb-2">
              <span className="text-xs text-[#DADBD9]/70 flex items-center gap-1.5">
                {p.name}
                {local[p.id] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
              </span>
              <div className="flex gap-1 mt-0.5">
                <input
                  type="password"
                  value={local[p.id] || ""}
                  onChange={(e) =>
                    setLocal({ ...local, [p.id]: e.target.value })
                  }
                  placeholder={`${p.id} key`}
                  className="flex-1 rounded-md border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-1 text-xs text-[#DADBD9] placeholder-[#DADBD9]/30 focus:outline-none"
                />
                {local[p.id] && (
                  <button
                    onClick={() => handleClear(p.id)}
                    className="text-xs text-red-400/70 hover:text-red-400 px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
          ))}
          <button
            onClick={handleSave}
            className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Model Selector ── */
function ModelSelector({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const groups = getModelsGroupedByProvider();
  return (
    <label className="block">
      {label && (
        <span className="text-xs text-[#DADBD9]/50 mb-1 block">{label}</span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-1.5 text-sm text-[#DADBD9] focus:outline-none"
      >
        {groups.map((g) => (
          <optgroup key={g.providerId} label={g.providerName}>
            {g.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/* ── Streaming Column Display ── */
function StreamingColumn({ col }: { col: StreamColumn }) {
  const model = getModelById(col.modelId);
  const providerNames: Record<string, string> = {
    openrouter: "OpenRouter",
    groq: "Groq",
    cerebras: "Cerebras",
  };

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[#C5E7EA]/15 bg-[#415557]/10 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-[#DADBD9]">
            {model?.displayName || col.modelId}
          </div>
          {model && (
            <div className="text-[10px] text-[#DADBD9]/40">
              via {providerNames[model.providerId] || model.providerId}
            </div>
          )}
        </div>
        {col.status === "streaming" && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </div>

      <div className="flex-1 text-sm text-[#DADBD9]/80 whitespace-pre-wrap overflow-y-auto max-h-96 min-h-[120px]">
        {col.content || (col.status === "idle" ? "" : "...")}
        {col.error && (
          <span className="text-red-400 text-xs block mt-2">{col.error}</span>
        )}
      </div>

      {(col.ttft !== null || col.totalTime !== null) && (
        <div className="mt-3 pt-2 border-t border-[#C5E7EA]/10 flex gap-4 text-[10px] text-[#DADBD9]/40">
          {col.ttft !== null && <span>TTFT: {col.ttft}ms</span>}
          {col.totalTime !== null && <span>Total: {col.totalTime}ms</span>}
          {col.tokenEstimate > 0 && <span>~{col.tokenEstimate} tokens</span>}
        </div>
      )}
    </div>
  );
}

/* ── Leaderboard ── */
function Leaderboard({ battles }: { battles: BattleRecord[] }) {
  const [open, setOpen] = useState(false);
  if (battles.length === 0) return null;

  const stats = new Map<string, { wins: number; losses: number; ties: number }>();
  for (const b of battles) {
    for (const id of [b.modelA, b.modelB]) {
      if (!stats.has(id)) stats.set(id, { wins: 0, losses: 0, ties: 0 });
    }
    if (b.winner === "tie") {
      stats.get(b.modelA)!.ties++;
      stats.get(b.modelB)!.ties++;
    } else {
      const winnerId = b.winner === "a" ? b.modelA : b.modelB;
      const loserId = b.winner === "a" ? b.modelB : b.modelA;
      stats.get(winnerId)!.wins++;
      stats.get(loserId)!.losses++;
    }
  }

  const sorted = Array.from(stats.entries())
    .map(([id, s]) => ({
      id,
      ...s,
      total: s.wins + s.losses + s.ties,
      winRate: s.wins / (s.wins + s.losses + s.ties),
    }))
    .sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="border-t border-[#C5E7EA]/10 mt-4 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-[#DADBD9]/50 hover:text-[#DADBD9]/70 transition-colors"
      >
        {open ? "Hide" : "Show"} Leaderboard ({battles.length} battles)
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {sorted.map((s) => {
            const model = getModelById(s.id);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between text-xs text-[#DADBD9]/60 py-1"
              >
                <span className="truncate mr-2">
                  {model?.displayName || s.id}
                </span>
                <span className="flex-none">
                  {Math.round(s.winRate * 100)}% ({s.wins}W-{s.losses}L-
                  {s.ties}T)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function ModelArena() {
  const [mode, setMode] = useState<"compare" | "battle">("compare");
  const [prompt, setPrompt] = useState("");
  const [byokKeys, setByokKeys] = useState<StoredKeys>({});
  const [battles, setBattles] = useState<BattleRecord[]>([]);

  // Compare mode state
  const [modelA, setModelA] = useState(AI_MODELS[0].id);
  const [modelB, setModelB] = useState(
    AI_MODELS.length > 1 ? AI_MODELS[1].id : AI_MODELS[0].id
  );

  // Columns state
  const [columns, setColumns] = useState<StreamColumn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const openByokRef = useRef<(() => void) | null>(null);

  // Battle mode state
  const [battleRevealed, setBattleRevealed] = useState(false);
  const [battleModelA, setBattleModelA] = useState("");
  const [battleModelB, setBattleModelB] = useState("");

  // Free-tier gating state
  const [usage, setUsage] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    setByokKeys(loadStoredKeys());
    setBattles(loadBattleHistory());
    setUsage(loadUsage());
    setUnlocked(loadUnlocked());
  }, []);

  const hasOwnKey = Object.values(byokKeys).some(Boolean);
  const dailyAllowance = FREE_DAILY_BATTLES + (unlocked ? EMAIL_BONUS_BATTLES : 0);
  const remaining = Math.max(0, dailyAllowance - usage);

  const streamToColumn = useCallback(
    async (
      modelId: string,
      promptText: string,
      colIndex: number,
      signal: AbortSignal,
      keys: StoredKeys
    ) => {
      const model = getModelById(modelId);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (model && keys) {
        const pk = keys[model.providerId as keyof StoredKeys];
        if (pk) headers["X-Provider-Key"] = pk;
      }

      const start = performance.now();
      let firstTokenTime: number | null = null;

      try {
        const res = await fetch("/api/tools/ai-gateway", {
          method: "POST",
          headers,
          body: JSON.stringify({
            modelId,
            messages: [{ role: "user", content: promptText }],
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.json();
          setColumns((prev) => {
            const next = [...prev];
            next[colIndex] = {
              ...next[colIndex],
              status: "error",
              error: err.error || "Request failed",
            };
            return next;
          });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          if (firstTokenTime === null) {
            firstTokenTime = Math.round(performance.now() - start);
          }

          setColumns((prev) => {
            const next = [...prev];
            const col = next[colIndex];
            const newContent = col.content + chunk;
            next[colIndex] = {
              ...col,
              content: newContent,
              ttft: firstTokenTime,
              tokenEstimate: Math.round(newContent.split(/\s+/).length / 0.75),
              status: "streaming",
            };
            return next;
          });
        }

        const totalTime = Math.round(performance.now() - start);
        setColumns((prev) => {
          const next = [...prev];
          next[colIndex] = { ...next[colIndex], totalTime, status: "done" };
          return next;
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setColumns((prev) => {
          const next = [...prev];
          next[colIndex] = {
            ...next[colIndex],
            status: "error",
            error: "Stream failed",
          };
          return next;
        });
      }
    },
    []
  );

  const handleCompare = async () => {
    if (!prompt.trim()) return;
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const initCols: StreamColumn[] = [
      { modelId: modelA, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
      { modelId: modelB, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
    ];
    setColumns(initCols);

    await Promise.all([
      streamToColumn(modelA, prompt.trim(), 0, controller.signal, byokKeys),
      streamToColumn(modelB, prompt.trim(), 1, controller.signal, byokKeys),
    ]);

    setIsRunning(false);
    abortRef.current = null;
  };

  const pickRandomModels = (): [string, string] => {
    const shuffled = [...AI_MODELS].sort(() => Math.random() - 0.5);
    const first = shuffled[0];
    const second =
      shuffled.find((m) => m.providerId !== first.providerId) || shuffled[1];
    return [first.id, second.id];
  };

  const handleBattle = async () => {
    if (!prompt.trim()) return;
    setIsRunning(true);
    setBattleRevealed(false);
    const controller = new AbortController();
    abortRef.current = controller;

    const [a, b] = pickRandomModels();
    setBattleModelA(a);
    setBattleModelB(b);

    const initCols: StreamColumn[] = [
      { modelId: a, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
      { modelId: b, content: "", ttft: null, totalTime: null, tokenEstimate: 0, status: "streaming" },
    ];
    setColumns(initCols);

    await Promise.all([
      streamToColumn(a, prompt.trim(), 0, controller.signal, byokKeys),
      streamToColumn(b, prompt.trim(), 1, controller.signal, byokKeys),
    ]);

    setIsRunning(false);
    abortRef.current = null;
  };

  const handleVote = (winner: "a" | "b" | "tie") => {
    setBattleRevealed(true);
    const record: BattleRecord = {
      modelA: battleModelA,
      modelB: battleModelB,
      winner,
      prompt: prompt.trim(),
      timestamp: Date.now(),
    };
    const updated = [record, ...battles];
    setBattles(updated);
    saveBattleHistory(updated);
  };

  const handleSend = () => {
    if (!prompt.trim() || isRunning) return;
    // BYOK users run on their own key — no gate. Free-tier users are metered
    // per local day and prompted for an email once they exhaust the allowance.
    if (!hasOwnKey && usage >= dailyAllowance) {
      setShowGate(true);
      return;
    }
    if (!hasOwnKey) {
      const next = usage + 1;
      setUsage(next);
      saveUsage(next);
    }
    if (mode === "compare") handleCompare();
    else handleBattle();
  };

  const handleUnlock = () => {
    setUnlocked(true);
    setShowGate(false);
  };

  const handleUseKeys = () => {
    setShowGate(false);
    openByokRef.current?.();
  };

  const handleClear = () => {
    setColumns([]);
    setBattleRevealed(false);
    abortRef.current?.abort();
    setIsRunning(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const bothDone = columns.length === 2 && columns.every((c) => c.status === "done" || c.status === "error");

  return (
    <main className="min-h-screen terrain-page-bg font-sans flex flex-col">
      <Head>
        <title>Model Arena | Brooks Roley</title>
      </Head>

      {/* Header */}
      <header className="border-b border-[#C5E7EA]/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-[#DADBD9]/50 hover:text-[#DADBD9] text-sm transition-colors"
          >
            &larr; Home
          </Link>
          <h1 className="text-lg font-semibold text-[#DADBD9]">
            Model Arena
          </h1>
        </div>
        <BYOKPanel keys={byokKeys} onUpdate={setByokKeys} openRef={openByokRef} />
      </header>

      {/* Mode Tabs */}
      <div className="border-b border-[#C5E7EA]/10 px-4 py-2 flex gap-1">
        {(["compare", "battle"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              handleClear();
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? "bg-[#C5E7EA]/20 text-[#C5E7EA]"
                : "text-[#DADBD9]/50 hover:text-[#DADBD9]"
            }`}
          >
            {m === "compare" ? "Compare" : "Battle"}
          </button>
        ))}
      </div>

      {/* Model Selectors (Compare mode only) */}
      {mode === "compare" && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 grid grid-cols-2 gap-4">
          <ModelSelector value={modelA} onChange={setModelA} label="Model A" />
          <ModelSelector value={modelB} onChange={setModelB} label="Model B" />
        </div>
      )}

      {mode === "battle" && columns.length === 0 && (
        <div className="px-4 py-6 text-center space-y-2">
          <p className="text-sm text-[#DADBD9]/60">
            Type a prompt and hit Send. Two random models will compete blindly.
          </p>
          {!Object.values(byokKeys).some(Boolean) && (
            <p className="text-xs text-amber-400/70">
              No API keys configured —{" "}
              <button
                onClick={() => openByokRef.current?.()}
                className="underline hover:text-amber-400"
              >
                add one in API Keys
              </button>{" "}
              (top right) to use Groq, OpenRouter, or Cerebras.
            </p>
          )}
        </div>
      )}

      {/* Streaming Columns */}
      {columns.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            {columns.map((col, i) => {
              if (mode === "battle" && !battleRevealed) {
                return (
                  <StreamingColumn
                    key={i}
                    col={{
                      ...col,
                      modelId: `Model ${i === 0 ? "A" : "B"}` as string,
                    }}
                  />
                );
              }
              return <StreamingColumn key={i} col={col} />;
            })}
          </div>

          {/* Battle voting */}
          {mode === "battle" && bothDone && !battleRevealed && (
            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => handleVote("a")}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
              >
                A wins
              </button>
              <button
                onClick={() => handleVote("tie")}
                className="px-6 py-2 rounded-lg text-sm font-medium border border-[#C5E7EA]/20 text-[#DADBD9]/70 hover:text-[#DADBD9] transition-colors"
              >
                Tie
              </button>
              <button
                onClick={() => handleVote("b")}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
              >
                B wins
              </button>
            </div>
          )}

          {/* Battle reveal */}
          {mode === "battle" && battleRevealed && (
            <div className="text-center mt-4 text-sm text-[#DADBD9]/60">
              <p>
                Model A: <strong className="text-[#DADBD9]">{getModelById(battleModelA)?.displayName || battleModelA}</strong>
                {" | "}
                Model B: <strong className="text-[#DADBD9]">{getModelById(battleModelB)?.displayName || battleModelB}</strong>
              </p>
            </div>
          )}

          {/* Re-run / Clear */}
          {bothDone && (
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={handleSend}
                className="px-4 py-1.5 rounded-lg text-xs text-[#DADBD9]/50 hover:text-[#DADBD9] border border-[#C5E7EA]/15 transition-colors"
              >
                Re-run
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-1.5 rounded-lg text-xs text-[#DADBD9]/50 hover:text-[#DADBD9] border border-[#C5E7EA]/15 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          {/* Leaderboard */}
          {mode === "battle" && <Leaderboard battles={battles} />}
        </div>
      )}

      {/* Empty state when no columns */}
      {columns.length === 0 && mode === "compare" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-sm text-[#DADBD9]/50">
            Pick two models, type a prompt below, and compare responses.
          </p>
          {!Object.values(byokKeys).some(Boolean) && (
            <p className="text-xs text-amber-400/70">
              Requires an API key —{" "}
              <button
                onClick={() => openByokRef.current?.()}
                className="underline hover:text-amber-400"
              >
                add one in API Keys
              </button>{" "}
              (top right).
            </p>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-[#C5E7EA]/20 bg-[#1c2426]/60 px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt to compare models…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-[#C5E7EA]/40 bg-[#415557]/50 px-3 py-2 text-sm text-[#DADBD9] placeholder-[#DADBD9]/50 focus:border-[#C5E7EA]/70 focus:outline-none"
            disabled={isRunning}
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || isRunning}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/30 text-[#C5E7EA] hover:bg-[#C5E7EA]/40 transition-colors disabled:opacity-40"
          >
            {isRunning ? "Running…" : "Send"}
          </button>
        </div>
        {!hasOwnKey && (
          <p className="mt-2 text-[10px] text-[#DADBD9]/40 text-right">
            {remaining} free {remaining === 1 ? "run" : "runs"} left today
            {!unlocked && remaining <= 3 && (
              <>
                {" · "}
                <button
                  onClick={() => setShowGate(true)}
                  className="underline hover:text-[#DADBD9]/70"
                >
                  unlock more
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {showGate && (
        <EmailGate
          onUnlock={handleUnlock}
          onUseKeys={handleUseKeys}
          onClose={() => setShowGate(false)}
        />
      )}
    </main>
  );
}
