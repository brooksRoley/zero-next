export type FreeModel = {
  id: string;
  displayName: string;
  contextLength: number;
};

export const FREE_MODELS: FreeModel[] = [
  {
    id: "nvidia/nemotron-3-nano-omni-free",
    displayName: "NVIDIA Nemotron 3 Nano Omni",
    contextLength: 256_000,
  },
  {
    id: "poolside/laguna-xs.2-free",
    displayName: "Poolside Laguna XS.2",
    contextLength: 131_000,
  },
  {
    id: "poolside/laguna-m.1-free",
    displayName: "Poolside Laguna M.1",
    contextLength: 131_000,
  },
];

export const DEFAULT_PROFILE_MODEL = FREE_MODELS[0].id;

export function getModelById(id: string): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}
