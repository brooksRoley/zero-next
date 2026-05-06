export type AIModel = {
  id: string;
  providerId: "openrouter" | "groq" | "cerebras";
  providerModelId: string;
  displayName: string;
  contextLength: number;
  capabilities: ("chat" | "vision" | "code")[];
  free: boolean;
  equivalentIds?: string[];
};

export const AI_MODELS: AIModel[] = [
  // ── OpenRouter (free tier) ──

  // --- Flagship / Large ---
  {
    id: "openrouter/nemotron-3-super",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-super-120b-a12b:free",
    displayName: "NVIDIA Nemotron 3 Super 120B",
    contextLength: 262_144,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/hermes-3-405b",
    providerId: "openrouter",
    providerModelId: "nousresearch/hermes-3-llama-3.1-405b:free",
    displayName: "Nous Hermes 3 405B",
    contextLength: 131_072,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/gpt-oss-120b",
    providerId: "openrouter",
    providerModelId: "openai/gpt-oss-120b:free",
    displayName: "OpenAI GPT-OSS 120B",
    contextLength: 131_072,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["groq/gpt-oss-120b", "cerebras/gpt-oss-120b"],
  },
  {
    id: "openrouter/gpt-oss-20b",
    providerId: "openrouter",
    providerModelId: "openai/gpt-oss-20b:free",
    displayName: "OpenAI GPT-OSS 20B",
    contextLength: 131_072,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/inclusionai-ling-1t",
    providerId: "openrouter",
    providerModelId: "inclusionai/ling-2.6-1t:free",
    displayName: "InclusionAI Ling 2.6 1T",
    contextLength: 262_144,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/tencent-hy3",
    providerId: "openrouter",
    providerModelId: "tencent/hy3-preview:free",
    displayName: "Tencent Hy3 Preview",
    contextLength: 262_144,
    capabilities: ["chat"],
    free: true,
  },

  // --- Code-focused ---
  {
    id: "openrouter/qwen3-coder",
    providerId: "openrouter",
    providerModelId: "qwen/qwen3-coder:free",
    displayName: "Qwen3 Coder 480B",
    contextLength: 262_000,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["cerebras/qwen3-coder-480b"],
  },
  {
    id: "openrouter/qwen3-next-80b",
    providerId: "openrouter",
    providerModelId: "qwen/qwen3-next-80b-a3b-instruct:free",
    displayName: "Qwen3 Next 80B",
    contextLength: 262_144,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/poolside-laguna-m1",
    providerId: "openrouter",
    providerModelId: "poolside/laguna-m.1:free",
    displayName: "Poolside Laguna M.1",
    contextLength: 131_072,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/poolside-laguna-xs2",
    providerId: "openrouter",
    providerModelId: "poolside/laguna-xs.2:free",
    displayName: "Poolside Laguna XS.2",
    contextLength: 131_072,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/baidu-cobuddy",
    providerId: "openrouter",
    providerModelId: "baidu/cobuddy:free",
    displayName: "Baidu CoBuddy",
    contextLength: 131_072,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/owl-alpha",
    providerId: "openrouter",
    providerModelId: "openrouter/owl-alpha",
    displayName: "Owl Alpha (Agentic)",
    contextLength: 1_048_756,
    capabilities: ["chat", "code"],
    free: true,
  },

  // --- Vision / Multimodal ---
  {
    id: "openrouter/gemma-4-31b",
    providerId: "openrouter",
    providerModelId: "google/gemma-4-31b-it:free",
    displayName: "Google Gemma 4 31B",
    contextLength: 262_144,
    capabilities: ["chat", "vision"],
    free: true,
  },
  {
    id: "openrouter/gemma-4-26b",
    providerId: "openrouter",
    providerModelId: "google/gemma-4-26b-a4b-it:free",
    displayName: "Google Gemma 4 26B MoE",
    contextLength: 262_144,
    capabilities: ["chat", "vision"],
    free: true,
  },
  {
    id: "openrouter/nemotron-nano-12b-vl",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-nano-12b-v2-vl:free",
    displayName: "NVIDIA Nemotron Nano 12B VL",
    contextLength: 128_000,
    capabilities: ["chat", "vision"],
    free: true,
  },
  {
    id: "openrouter/nemotron-nano-omni",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    displayName: "NVIDIA Nemotron Nano Omni 30B",
    contextLength: 256_000,
    capabilities: ["chat", "vision"],
    free: true,
  },
  {
    id: "openrouter/baidu-ocr",
    providerId: "openrouter",
    providerModelId: "baidu/qianfan-ocr-fast:free",
    displayName: "Baidu Qianfan OCR Fast",
    contextLength: 65_536,
    capabilities: ["chat", "vision"],
    free: true,
  },

  // --- Mid-size / Efficient ---
  {
    id: "openrouter/llama-3.3-70b",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-3.3-70b-instruct:free",
    displayName: "Meta Llama 3.3 70B",
    contextLength: 65_536,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["groq/llama-3.3-70b"],
  },
  {
    id: "openrouter/nemotron-nano-30b",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-nano-30b-a3b:free",
    displayName: "NVIDIA Nemotron 3 Nano 30B",
    contextLength: 256_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/minimax-m2.5",
    providerId: "openrouter",
    providerModelId: "minimax/minimax-m2.5:free",
    displayName: "MiniMax M2.5",
    contextLength: 196_608,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/glm-4.5-air",
    providerId: "openrouter",
    providerModelId: "z-ai/glm-4.5-air:free",
    displayName: "Z.AI GLM 4.5 Air",
    contextLength: 131_072,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["cerebras/glm-4.7"],
  },
  {
    id: "openrouter/dolphin-mistral-24b",
    providerId: "openrouter",
    providerModelId: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    displayName: "Venice Dolphin Mistral 24B",
    contextLength: 32_768,
    capabilities: ["chat"],
    free: true,
  },

  // --- Small / Fast ---
  {
    id: "openrouter/nemotron-nano-9b",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-nano-9b-v2:free",
    displayName: "NVIDIA Nemotron Nano 9B",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/llama-3.2-3b",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-3.2-3b-instruct:free",
    displayName: "Meta Llama 3.2 3B",
    contextLength: 131_072,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/liquid-1.2b-instruct",
    providerId: "openrouter",
    providerModelId: "liquid/lfm-2.5-1.2b-instruct:free",
    displayName: "Liquid LFM 1.2B Instruct",
    contextLength: 32_768,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/liquid-1.2b-thinking",
    providerId: "openrouter",
    providerModelId: "liquid/lfm-2.5-1.2b-thinking:free",
    displayName: "Liquid LFM 1.2B Thinking",
    contextLength: 32_768,
    capabilities: ["chat"],
    free: true,
  },

  // --- Router ---
  {
    id: "openrouter/free-router",
    providerId: "openrouter",
    providerModelId: "openrouter/free",
    displayName: "OpenRouter Free Router",
    contextLength: 200_000,
    capabilities: ["chat", "vision"],
    free: true,
  },

  // ── Groq ──
  {
    id: "groq/llama-3.3-70b",
    providerId: "groq",
    providerModelId: "llama-3.3-70b-versatile",
    displayName: "Meta Llama 3.3 70B Versatile",
    contextLength: 128_000,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/llama-3.3-70b"],
  },
  {
    id: "groq/llama-4-scout",
    providerId: "groq",
    providerModelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    displayName: "Meta Llama 4 Scout",
    contextLength: 512_000,
    capabilities: ["chat", "vision"],
    free: true,
  },
  {
    id: "groq/llama-4-maverick",
    providerId: "groq",
    providerModelId: "meta-llama/llama-4-maverick-17b-128e-instruct",
    displayName: "Meta Llama 4 Maverick",
    contextLength: 256_000,
    capabilities: ["chat", "vision"],
    free: true,
  },
  {
    id: "groq/llama-3.1-8b",
    providerId: "groq",
    providerModelId: "llama-3.1-8b-instant",
    displayName: "Meta Llama 3.1 8B Instant",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["cerebras/llama-3.1-8b"],
  },
  {
    id: "groq/qwq-32b",
    providerId: "groq",
    providerModelId: "qwen-qwq-32b",
    displayName: "Qwen QwQ 32B",
    contextLength: 128_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "groq/gpt-oss-120b",
    providerId: "groq",
    providerModelId: "openai/gpt-4.1-nano",
    displayName: "OpenAI GPT-4.1 Nano",
    contextLength: 1_047_576,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/gpt-oss-120b", "cerebras/gpt-oss-120b"],
  },
  {
    id: "groq/deepseek-r1-70b",
    providerId: "groq",
    providerModelId: "deepseek-r1-distill-llama-70b",
    displayName: "DeepSeek R1 Distill 70B",
    contextLength: 128_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "groq/mistral-saba-24b",
    providerId: "groq",
    providerModelId: "mistral-saba-24b",
    displayName: "Mistral Saba 24B",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "groq/gemma-2-9b",
    providerId: "groq",
    providerModelId: "gemma2-9b-it",
    displayName: "Google Gemma 2 9B IT",
    contextLength: 8_192,
    capabilities: ["chat"],
    free: true,
  },

  // ── Cerebras ──
  {
    id: "cerebras/qwen3-235b",
    providerId: "cerebras",
    providerModelId: "qwen-3-235b-a22b",
    displayName: "Qwen3 235B A22B (~1400 tok/s)",
    contextLength: 64_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "cerebras/gpt-oss-120b",
    providerId: "cerebras",
    providerModelId: "gpt-4.1-nano",
    displayName: "GPT-4.1 Nano (~3000 tok/s)",
    contextLength: 1_047_576,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/gpt-oss-120b", "groq/gpt-oss-120b"],
  },
  {
    id: "cerebras/qwen3-coder-480b",
    providerId: "cerebras",
    providerModelId: "qwen-3-coder-480b-a35b",
    displayName: "Qwen3 Coder 480B",
    contextLength: 65_536,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["openrouter/qwen3-coder"],
  },
  {
    id: "cerebras/llama-3.1-8b",
    providerId: "cerebras",
    providerModelId: "llama3.1-8b",
    displayName: "Llama 3.1 8B (~1800 tok/s)",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["groq/llama-3.1-8b"],
  },
  {
    id: "cerebras/glm-4.7",
    providerId: "cerebras",
    providerModelId: "glm-4.7",
    displayName: "Z.AI GLM 4.7",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["openrouter/glm-4.5-air"],
  },
];

export const DEFAULT_PROFILE_MODEL = "openrouter/nemotron-nano-9b";

export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.id === id);
}

export function getModelsByProvider(providerId: string): AIModel[] {
  return AI_MODELS.filter((m) => m.providerId === providerId);
}

export function getModelsGroupedByProvider(): {
  providerId: string;
  providerName: string;
  models: AIModel[];
}[] {
  const groups: Map<string, { providerName: string; models: AIModel[] }> = new Map();
  for (const model of AI_MODELS) {
    if (!groups.has(model.providerId)) {
      const names: Record<string, string> = {
        openrouter: "OpenRouter",
        groq: "Groq",
        cerebras: "Cerebras",
      };
      groups.set(model.providerId, {
        providerName: names[model.providerId] || model.providerId,
        models: [],
      });
    }
    groups.get(model.providerId)!.models.push(model);
  }
  return Array.from(groups.entries()).map(([providerId, data]) => ({
    providerId,
    ...data,
  }));
}
