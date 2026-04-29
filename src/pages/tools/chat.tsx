import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { FREE_MODELS } from "src/lib/openrouter/models";
import { assignColor, assignEmoji } from "src/lib/openrouter/colors";

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

async function generateProfile(name: string, oneLiner: string): Promise<string> {
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
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/tools/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const [modelId, setModelId] = useState(FREE_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return setError("Give your character a name");
    if (!oneLiner.trim()) return setError("Describe their personality in a sentence");
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
        <h2 className="text-lg font-semibold text-[#DADBD9] mb-4">New Character</h2>

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
          <span className="text-sm text-[#DADBD9]/70">Personality (one-liner)</span>
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
            {FREE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchCharacters()
      .then(setCharacters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCharacterCreated = (c: Character) => {
    setCharacters((prev) => [c, ...prev]);
    setShowModal(false);
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
        controller.signal
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
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#C5E7EA]/20 text-[#C5E7EA] hover:bg-[#C5E7EA]/30 transition-colors"
        >
          + Add Character
        </button>
      </header>

      {/* Character Strip */}
      {characters.length > 0 && (
        <div className="border-b border-[#C5E7EA]/10 px-4 py-3 flex gap-3 overflow-x-auto">
          {characters.map((c) => (
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
                  {FREE_MODELS.find((m) => m.id === c.model)?.displayName ||
                    c.model}
                </div>
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
          ))}
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
        {loading && (
          <p className="text-[#DADBD9]/40 text-sm text-center py-8">
            Loading characters...
          </p>
        )}
        {!loading && characters.length === 0 && messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[#DADBD9]/50 text-sm mb-2">
              No characters yet.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="text-[#C5E7EA] text-sm hover:underline"
            >
              Create your first character
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
              <div className="whitespace-pre-wrap">
                {m.content || "..."}
              </div>
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
