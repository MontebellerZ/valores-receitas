import { useOutletContext } from "react-router-dom";
import type { useWorkspace } from "./useWorkspace";

export function useWorkspaceContext() {
  return useOutletContext<ReturnType<typeof useWorkspace>>();
}
