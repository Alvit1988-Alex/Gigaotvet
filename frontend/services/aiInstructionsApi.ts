import { apiFetch } from "./apiClient";

const AI_INSTRUCTIONS_PATH = "/api/ai-instructions";

export type AIInstructions = {
  id?: number | null;
  text: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function fetchCurrentInstructions(): Promise<AIInstructions> {
  return apiFetch<AIInstructions>(`${AI_INSTRUCTIONS_PATH}/current`);
}

export async function updateInstructions(text: string): Promise<AIInstructions> {
  return apiFetch<AIInstructions>(AI_INSTRUCTIONS_PATH, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}
