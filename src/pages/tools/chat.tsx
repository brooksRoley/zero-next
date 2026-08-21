import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  AI_MODELS,
  getModelById,
  getModelsGroupedByProvider,
} from "src/lib/ai-providers/models";
import { assignColor, assignEmoji } from "src/lib/ai-providers/colors";
import { track } from "src/lib/analytics";

/* ── Types ── */
type Character = {
  id: string;
  name: string;
  one_liner: string;
  profile: string;
  model: string;
  color: string;
  avatar_emoji: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  characterId?: string;
  characterName?: string;
  characterColor?: string;
  characterEmoji?: string;
  content: string;
  timestamp: number;
};

type StoredKeys = {
  openrouter?: string;
  groq?: string;
  cerebras?: string;
};

/* ── BYOK helpers ── */
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

/* ── API helpers ── */
async function fetchCharacters(): Promise<Character[]> {
  const res = await fetch("/api/tools/characters");
  if (!res.ok) throw new Error("Failed to fetch characters");
  return res.json();
}

async function createCharacterInDb(data: {
  name: string;
  one_liner: string;
  profile: string;
  model: string;
  color: string;
  avatar_emoji: string;
}): Promise<Character> {
  const res = await fetch("/api/tools/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create character");
  return res.json();
}

async function deleteCharacterFromDb(id: string): Promise<void> {
  await fetch(`/api/tools/characters?id=${id}`, { method: "DELETE" });
}

/* ── First-run demo characters ── */
const DEMO_SEED_FLAG = "chat_demo_seeded";

const DEMO_CHARACTERS = [
  {
    name: "Ada",
    one_liner: "A precise logician who reasons out loud and loves a clean argument.",
    profile:
      "You are Ada, a sharp, good-natured logician. You think in clear steps, name your assumptions, and gently point out flaws in reasoning. You enjoy puzzles, definitions, and getting to the heart of a question. Keep replies concise (2-4 sentences) and conversational — you're chatting, not lecturing.",
  },
  {
    name: "Bard",
    one_liner: "A warm storyteller who answers in vivid little scenes and metaphors.",
    profile:
      "You are Bard, an imaginative storyteller. You reply with warmth and color, often reaching for a small image, scene, or metaphor to make a point land. You're playful but never long-winded — keep replies to 2-4 sentences. You love riffing off whatever the others say.",
  },
];

async function seedDemoCharacters(): Promise<Character[]> {
  const created: Character[] = [];
  for (const demo of DEMO_CHARACTERS) {
    try {
      const character = await createCharacterInDb({
        name: demo.name,
        one_liner: demo.one_liner,
        profile: demo.profile,
        model: AI_MODELS[0].id,
        color: assignColor(created.map((c) => c.color)),
        avatar_emoji: assignEmoji(created.map((c) => c.avatar_emoji)),
      });
      created.push(character);
    } catch (err) {
      console.error("Failed to seed demo character", demo.name, err);
    }
  }
  return created;
}

async function generateProfile(
  name: string,
  oneLiner: string
): Promise<string> {
  const res = await fetch("/api/tools/generate-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, oneLiner }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate profile");
  }
  const data = await res.json();
  return data.profile;
}

async function streamCharacterResponse(
  modelId: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  byokKeys?: StoredKeys
): Promise<void> {
  const model = getModelById(modelId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (model && byokKeys) {
    const providerKey =
      byokKeys[model.providerId as keyof StoredKeys];
    if (providerKey) {
      headers["X-Provider-Key"] = providerKey;
    }
  }

  const res = await fetch("/api/tools/ai-gateway", {
    method: "POST",
    headers,
    body: JSON.stringify({ modelId, systemPrompt, messages }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chat request failed");
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

/* ── Unique ID generator ── */
let _msgId = 0;
function msgId(): string {
  return `msg-${Date.now()}-${++_msgId}`;
}

/* ── BYOK Keys Panel ── */
function BYOKPanel({
  keys,
  onUpdate,
}: {
  keys: StoredKeys;
  onUpdate: (keys: StoredKeys) => void;
}) {
  const [open, setOpen] = useState(false);
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

/* ── Add Character Modal ── */
function AddCharacterModal({
  onClose,
  onCreated,
  existingColors,
  existingEmojis,
}: {
  onClose: () => void;
  onCreated: (c: Character) => void;
  existingColors: string[];
  existingEmojis: string[];
}) {
  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [modelId, setModelId] = useState(AI_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const modelGroups = getModelsGroupedByProvider();

  const handleCreate = async () => {
    if (!name.trim()) return setError("Give your character a name");
    if (!oneLiner.trim())
      return setError("Describe their personality in a sentence");
    setLoading(true);
    setError("");
    try {
      const profile = await generateProfile(name.trim(), oneLiner.trim());
      const color = assignColor(existingColors);
      const avatar_emoji = assignEmoji(existingEmojis);
      const character = await createCharacterInDb({
        name: name.trim(),
        one_liner: oneLiner.trim(),
        profile,
        model: modelId,
        color,
        avatar_emoji,
      });
      onCreated(character);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[#C5E7EA]/20 bg-[#1c2426] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#DADBD9] mb-4">
          New Character
        </h2>

        <label className="block mb-3">
          <span className="text-sm text-[#DADBD9]/70">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Captain Blackbeard"
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm text-[#DADBD9]/70">
            Personality (one-liner)
          </span>
          <input
            type="text"
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="Sarcastic pirate who philosophizes about the sea"
            maxLength={280}
            className="mt-1 w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm text-[#DADBD9]/70">Model</span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-[#DADBD9] focus:border-[#C5E7EA]/50 focus:outline-none"
          >
            {modelGroups.map((group) => (
              <optgroup key={group.providerId} label={group.providerName}>
                {group.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-[#DADBD9]/70 hover:text-[#DADBD9] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors disabled:opacity-50"
          >
            {loading ? "Generating profile..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page Component ── */
export default function ChatSandbox() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sendTo, setSendTo] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [streamingCharId, setStreamingCharId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // If the character fetch is still pending after 2s, stop blocking on the
  // spinner and show the empty state so the "+ Add Character" path is usable
  // even on a slow or hung request. Characters still slot in if they arrive.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [byokKeys, setByokKeys] = useState<StoredKeys>({});
  const [showDemoBanner, setShowDemoBanner] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    async function init() {
      try {
        const existing = await fetchCharacters();
        const alreadySeeded =
          typeof window !== "undefined" &&
          localStorage.getItem(DEMO_SEED_FLAG);
        if (existing.length === 0 && !alreadySeeded) {
          const seeded = await seedDemoCharacters();
          localStorage.setItem(DEMO_SEED_FLAG, "1");
          setCharacters(seeded);
          if (seeded.length > 0) setShowDemoBanner(true);
        } else {
          setCharacters(existing);
        }
      } catch (err) {
        console.error(err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    init();
    setByokKeys(loadStoredKeys());
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoadTimedOut(true), 2000);
    return () => clearTimeout(timer);
  }, [loading]);

  const handleCharacterCreated = (c: Character) => {
    setCharacters((prev) => [c, ...prev]);
    setShowModal(false);
    track("chat_character_created", {
      page: "/tools/chat",
      metadata: { model: c.model, castSize: characters.length + 1 },
    });
  };

  const handleDeleteCharacter = async (id: string) => {
    await deleteCharacterFromDb(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setMessages((prev) => prev.filter((m) => m.characterId !== id));
    if (sendTo === id) setSendTo("all");
  };

  const buildContext = (
    characterId: string
  ): { role: "user" | "assistant"; content: string }[] => {
    return messages.map((m) => {
      if (m.role === "user") {
        return { role: "user" as const, content: m.content };
      }
      if (m.characterId !== characterId) {
        return {
          role: "user" as const,
          content: `[${m.characterName}]: ${m.content}`,
        };
      }
      return { role: "assistant" as const, content: m.content };
    });
  };

  const sendToCharacter = async (character: Character, userMsg?: string) => {
    setStreamingCharId(character.id);
    const placeholder: ChatMessage = {
      id: msgId(),
      role: "assistant",
      characterId: character.id,
      characterName: character.name,
      characterColor: character.color,
      characterEmoji: character.avatar_emoji,
      content: "",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, placeholder]);

    const context = buildContext(character.id);
    if (userMsg) {
      context.push({ role: "user", content: userMsg });
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamCharacterResponse(
        character.model,
        character.profile,
        context,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        },
        controller.signal,
        byokKeys
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholder.id
            ? { ...m, content: m.content || "[Error: response failed]" }
            : m
        )
      );
    } finally {
      setStreamingCharId(null);
      abortRef.current = null;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || characters.length === 0) return;
    setInput("");

    const userMessage: ChatMessage = {
      id: msgId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    track("chat_message_sent", {
      page: "/tools/chat",
      metadata: { recipients: sendTo, castSize: characters.length },
    });

    if (sendTo === "all") {
      for (const char of characters) {
        await sendToCharacter(char, text);
      }
    } else {
      const char = characters.find((c) => c.id === sendTo);
      if (char) await sendToCharacter(char, text);
    }
  };

  const handleNextRound = async (targetId?: string) => {
    track("chat_next_round", {
      page: "/tools/chat",
      metadata: { targeted: Boolean(targetId), castSize: characters.length },
    });
    if (targetId) {
      const char = characters.find((c) => c.id === targetId);
      if (char) await sendToCharacter(char);
    } else {
      for (const char of characters) {
        await sendToCharacter(char);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getModelDisplayInfo = (modelIdStr: string) => {
    const model = getModelById(modelIdStr);
    if (model) {
      const providerNames: Record<string, string> = {
        openrouter: "OpenRouter",
        groq: "Groq",
        cerebras: "Cerebras",
      };
      return {
        name: model.displayName,
        provider: providerNames[model.providerId] || model.providerId,
      };
    }
    return { name: modelIdStr, provider: "" };
  };

  return (
    <main className="min-h-screen terrain-page-bg font-sans flex flex-col">
      <Head>
        <title>Chat Sandbox | Brooks Roley</title>
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
            Chat Sandbox
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <BYOKPanel keys={byokKeys} onUpdate={setByokKeys} />
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
          >
            + Add Character
          </button>
        </div>
      </header>

      {/* Demo Mode Banner */}
      {showDemoBanner && (
        <div className="border-b border-[#C5E7EA]/10 bg-[#C5E7EA]/5 px-4 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-[#DADBD9]/70">
            Demo mode — these characters run on the server key. Add your own API
            keys to unlock all models.
          </p>
          <button
            onClick={() => setShowDemoBanner(false)}
            className="shrink-0 text-[#DADBD9]/40 hover:text-[#DADBD9] text-sm transition-colors"
            aria-label="Dismiss demo banner"
          >
            &times;
          </button>
        </div>
      )}

      {/* Character Strip */}
      {characters.length > 0 && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 flex gap-3 overflow-x-auto">
          {characters.map((c) => {
            const info = getModelDisplayInfo(c.model);
            return (
              <div
                key={c.id}
                className="flex-none flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer hover:bg-[#415557]/30 transition-colors"
                style={{ borderColor: c.color + "40" }}
                onClick={() =>
                  setExpandedProfile(expandedProfile === c.id ? null : c.id)
                }
              >
                <span className="text-lg">{c.avatar_emoji}</span>
                <div>
                  <div className="font-medium text-[#DADBD9]">{c.name}</div>
                  <div className="text-xs text-[#DADBD9]/50">
                    {info.name}
                  </div>
                  {info.provider && (
                    <div className="text-[10px] text-[#DADBD9]/35">
                      via {info.provider}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCharacter(c.id);
                  }}
                  className="ml-2 text-[#DADBD9]/30 hover:text-red-400 transition-colors"
                  title="Remove character"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Profile View */}
      {expandedProfile && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 bg-[#415557]/10">
          <pre className="text-sm text-[#DADBD9]/80 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
            {characters.find((c) => c.id === expandedProfile)?.profile}
          </pre>
        </div>
      )}

      {/* Chat Log */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && !loadTimedOut && (
          <p className="text-[#DADBD9]/40 text-sm text-center py-8">
            Loading characters...
          </p>
        )}
        {(!loading || loadTimedOut) &&
          characters.length === 0 &&
          messages.length === 0 && (
            <div className="text-center py-16">
              {loadError ? (
                <p className="text-red-300/80 text-sm mb-3">
                  Couldn&apos;t load saved characters — check your connection
                  and refresh, or add a new one below.
                </p>
              ) : (
                <p className="text-[#DADBD9]/50 text-sm mb-3">
                  No characters yet — add your first character to get started.
                </p>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
              >
                + Add Character
              </button>
            </div>
          )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-[#C5E7EA]/15 text-[#DADBD9]"
                  : "border bg-[#415557]/20 text-[#DADBD9]"
              }`}
              style={
                m.role === "assistant"
                  ? { borderColor: (m.characterColor || "#666") + "40" }
                  : undefined
              }
            >
              {m.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{m.characterEmoji}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: m.characterColor }}
                  >
                    {m.characterName}
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{m.content || "..."}</div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      {characters.length > 0 && (
        <div className="border-t border-[#C5E7EA]/10 px-4 py-3">
          <div className="flex gap-2 items-end">
            <select
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              className="rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-2 py-2 text-sm text-[#DADBD9] focus:outline-none"
            >
              <option value="all">All Characters</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.avatar_emoji} {c.name}
                </option>
              ))}
            </select>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-[#C5E7EA]/20 bg-[#415557]/30 px-3 py-2 text-sm text-[#DADBD9] placeholder-[#DADBD9]/30 focus:border-[#C5E7EA]/50 focus:outline-none"
              disabled={!!streamingCharId}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !!streamingCharId}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={() => handleNextRound()}
              disabled={!!streamingCharId || messages.length === 0}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-[#C5E7EA]/20 text-[#DADBD9]/70 hover:text-[#DADBD9] hover:bg-[#415557]/30 transition-colors disabled:opacity-50"
              title="All characters respond to the conversation"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AddCharacterModal
          onClose={() => setShowModal(false)}
          onCreated={handleCharacterCreated}
          existingColors={characters.map((c) => c.color)}
          existingEmojis={characters.map((c) => c.avatar_emoji)}
        />
      )}
    </main>
  );
}
