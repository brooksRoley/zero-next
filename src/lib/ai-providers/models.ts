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
  // ── OpenRouter ──
  {
    id: "openrouter/nvidia-nemotron-3-super",
    providerId: "openrouter",
    providerModelId: "nvidia/llama-3.3-nemotron-super-49b-v1:free",
    displayName: "NVIDIA Nemotron Super 49B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gpt-oss-120b",
    providerId: "openrouter",
    providerModelId: "openai/gpt-4.1-nano:free",
    displayName: "OpenAI GPT-4.1 Nano",
    contextLength: 1_047_576,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["groq/gpt-oss-120b", "cerebras/gpt-oss-120b"],
  },
  {
    id: "openrouter/llama-3.3-70b",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-3.3-70b-instruct:free",
    displayName: "Meta Llama 3.3 70B",
    contextLength: 131_000,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["groq/llama-3.3-70b"],
  },
  {
    id: "openrouter/llama-4-scout",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-4-scout:free",
    displayName: "Meta Llama 4 Scout",
    contextLength: 512_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["groq/llama-4-scout"],
  },
  {
    id: "openrouter/llama-4-maverick",
    providerId: "openrouter",
    providerModelId: "meta-llama/llama-4-maverick:free",
    displayName: "Meta Llama 4 Maverick",
    contextLength: 256_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["groq/llama-4-maverick"],
  },
  {
    id: "openrouter/qwen3-235b",
    providerId: "openrouter",
    providerModelId: "qwen/qwen3-235b-a22b:free",
    displayName: "Qwen3 235B A22B",
    contextLength: 40_960,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["cerebras/qwen3-235b"],
  },
  {
    id: "openrouter/qwen3-coder-480b",
    providerId: "openrouter",
    providerModelId: "qwen/qwen3-coder-480b-a35b:free",
    displayName: "Qwen3 Coder 480B",
    contextLength: 65_536,
    capabilities: ["chat", "code"],
    free: true,
    equivalentIds: ["cerebras/qwen3-coder-480b"],
  },
  {
    id: "openrouter/gemma-4-12b",
    providerId: "openrouter",
    providerModelId: "google/gemma-4-12b-it:free",
    displayName: "Google Gemma 4 12B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3-27b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3-27b-it:free",
    displayName: "Google Gemma 3 27B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3-12b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3-12b-it:free",
    displayName: "Google Gemma 3 12B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3-4b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3-4b-it:free",
    displayName: "Google Gemma 3 4B",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/mistral-small-3.1",
    providerId: "openrouter",
    providerModelId: "mistralai/mistral-small-3.1-24b-instruct:free",
    displayName: "Mistral Small 3.1 24B",
    contextLength: 131_000,
    capabilities: ["chat", "code", "vision"],
    free: true,
  },
  {
    id: "openrouter/devstral-2",
    providerId: "openrouter",
    providerModelId: "mistralai/devstral-2:free",
    displayName: "Mistral Devstral 2 123B",
    contextLength: 131_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/minimax-m2.5",
    providerId: "openrouter",
    providerModelId: "minimax/minimax-m2.5:free",
    displayName: "MiniMax M2.5",
    contextLength: 1_000_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/glm-4.5-air",
    providerId: "openrouter",
    providerModelId: "zhipu-ai/glm-4-air:free",
    displayName: "Z.AI GLM 4 Air",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
    equivalentIds: ["cerebras/glm-4.7"],
  },
  {
    id: "openrouter/nous-hermes-3-405b",
    providerId: "openrouter",
    providerModelId: "nousresearch/hermes-3-llama-3.1-405b:free",
    displayName: "Nous Hermes 3 405B",
    contextLength: 16_000,
    capabilities: ["chat", "code"],
    free: true,
  },
  {
    id: "openrouter/ling-2.6-flash",
    providerId: "openrouter",
    providerModelId: "inclusionai/ling-2.6-flash:free",
    displayName: "InclusionAI Ling 2.6 Flash",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/gemma-3n-4b",
    providerId: "openrouter",
    providerModelId: "google/gemma-3n-e4b-it:free",
    displayName: "Google Gemma 3n 4B",
    contextLength: 32_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/free-router",
    providerId: "openrouter",
    providerModelId: "openrouter/auto",
    displayName: "OpenRouter Auto (Free)",
    contextLength: 128_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/nemotron-3-nano",
    providerId: "openrouter",
    providerModelId: "nvidia/nemotron-3-nano-omni-free",
    displayName: "NVIDIA Nemotron 3 Nano Omni",
    contextLength: 256_000,
    capabilities: ["chat"],
    free: true,
  },
  {
    id: "openrouter/arcee-trinity",
    providerId: "openrouter",
    providerModelId: "arcee-ai/arcee-trinity-large-preview:free",
    displayName: "Arcee Trinity Large Preview",
    contextLength: 131_000,
    capabilities: ["chat"],
    free: true,
  },

  // ── Groq ──
  {
    id: "groq/llama-4-scout",
    providerId: "groq",
    providerModelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    displayName: "Meta Llama 4 Scout",
    contextLength: 512_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["openrouter/llama-4-scout"],
  },
  {
    id: "groq/llama-4-maverick",
    providerId: "groq",
    providerModelId: "meta-llama/llama-4-maverick-17b-128e-instruct",
    displayName: "Meta Llama 4 Maverick",
    contextLength: 256_000,
    capabilities: ["chat", "vision"],
    free: true,
    equivalentIds: ["openrouter/llama-4-maverick"],
  },
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
    equivalentIds: ["openrouter/qwen3-235b"],
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
    equivalentIds: ["openrouter/qwen3-coder-480b"],
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

export const DEFAULT_PROFILE_MODEL = "openrouter/nemotron-3-nano";

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
