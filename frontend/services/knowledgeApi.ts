import { apiFetch } from "./apiClient";

const KNOWLEDGE_FILES_PATH = "/api/knowledge/files";

export type KnowledgeFile = {
  id: number;
  filename_original: string;
  size_bytes: number;
  total_chunks: number;
  created_at: string;
};

export async function fetchKnowledgeFiles(): Promise<KnowledgeFile[]> {
  return apiFetch<KnowledgeFile[]>(KNOWLEDGE_FILES_PATH);
}

export async function uploadKnowledgeFile(file: File): Promise<KnowledgeFile> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<KnowledgeFile>(KNOWLEDGE_FILES_PATH, {
    method: "POST",
    body: formData,
  });
}

export async function deleteKnowledgeFile(fileId: number): Promise<void> {
  await apiFetch<void>(`${KNOWLEDGE_FILES_PATH}/${fileId}`, {
    method: "DELETE",
  });
}
