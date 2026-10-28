import axios from "axios";

type ApiProblem = {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
};

const apiUrl = import.meta.env.VITE_API_URL?.trim();
if (!apiUrl) {
  throw new Error(
    "Configure VITE_API_URL no .env com o endereço completo da API, incluindo /api.",
  );
}

export const api = axios.create({
  baseURL: apiUrl.replace(/\/+$/, ""),
  withCredentials: true,
});

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiProblem>(error)) {
    const problem = error.response?.data;
    const validationMessages = Object.values(problem?.errors ?? {})
      .flat()
      .join(" ");
    return problem?.detail || validationMessages || problem?.title || fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
