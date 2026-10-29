import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "../services/http";

export type Resource<T> =
  | { status: "loading"; data?: undefined }
  | { status: "missing"; data?: undefined }
  | { status: "error"; data?: undefined }
  | { status: "ready"; data: T };

/** Loads one record by id (deep links and detail screens); `null` from the fetcher means 404. */
export function useResource<T>(
  fetcher: (id: string, signal: AbortSignal) => Promise<T | null>,
  id: string | undefined,
  version = 0,
  errorMessage = "Não foi possível carregar o registro.",
): Resource<T> {
  const key = JSON.stringify([id ?? null, version]);
  const [result, setResult] = useState<{ key: string; value: Resource<T> }>();
  useEffect(() => {
    const [currentId] = JSON.parse(key) as [string | null];
    if (!currentId) return;
    const controller = new AbortController();
    fetcher(currentId, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setResult({ key, value: data === null ? { status: "missing" } : { status: "ready", data } });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult({ key, value: { status: "error" } });
      toast.error(getApiErrorMessage(error, errorMessage), { toastId: `resource-${errorMessage}` });
    });
    return () => controller.abort();
  }, [key, fetcher, errorMessage]);
  if (!id) return { status: "missing" };
  // While a newer version loads, keep showing the previous copy of the same record.
  if (result?.key !== key) {
    const [previousId] = result ? JSON.parse(result.key) as [string | null] : [null];
    return previousId === id && result?.value.status === "ready" ? result.value : { status: "loading" };
  }
  return result.value;
}
