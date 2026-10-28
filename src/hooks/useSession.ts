import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import type { UserSession } from "../domain/models";
import { authService } from "../services/auth";
import { getApiErrorMessage } from "../services/http";

export function useSession() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const restoreSession = async () => {
      try {
        const restoredSession = await authService.getSession(controller.signal);
        setSession(restoredSession);
      } catch (error) {
        if (
          !controller.signal.aborted &&
          !(isAxiosError(error) && error.response?.status === 401)
        ) {
          toast.error(
            getApiErrorMessage(error, "Não foi possível verificar sua sessão."),
            {
              toastId: "session-restore",
            },
          );
          console.error("Não foi possível restaurar a sessão.", error);
        }
      } finally {
        if (!controller.signal.aborted) setSessionChecked(true);
      }
    };
    void restoreSession();
    return () => controller.abort();
  }, []);
  const signOut = async () => {
    setSession(null);
    try {
      await authService.logout();
      toast.success("Sessão encerrada.");
    } catch (error) {
      toast.error(
        "A sessão foi encerrada neste dispositivo, mas a API não confirmou o logout.",
      );
      console.error("Não foi possível encerrar a sessão na API.", error);
    }
  };
  return { session, sessionChecked, handleAuthenticated: setSession, signOut };
}
