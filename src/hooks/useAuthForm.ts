import { useEffect, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { useLocation, useMatch, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { authService } from "../services/auth";
import { getApiErrorMessage } from "../services/http";
import type { UserSession } from "../domain/models";
import { paths } from "../app/paths";

type AuthMode = "login" | "register";

export function useAuthForm(onAuthenticated: (session: UserSession) => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const mode: AuthMode = useMatch(paths.register) ? "register" : "login";
  const [confirmation, setConfirmation] = useState(() => {
    const search = new URLSearchParams(location.search);
    const userId = search.get("confirmUserId");
    const token = search.get("confirmToken");
    search.delete("confirmUserId");
    search.delete("confirmToken");
    return userId && token
      ? { userId, token, search: search.toString() }
      : null;
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!confirmation) return;
    const controller = new AbortController();
    void authService
      .confirmEmail(confirmation.userId, confirmation.token, controller.signal)
      .then(() => {
        if (controller.signal.aborted) return;
        setConfirmation(null);
        navigate(
          { pathname: paths.login, search: confirmation.search },
          { replace: true },
        );
        toast.success("Email confirmado. Agora você pode entrar na sua conta.");
      })
      .catch((confirmationError: unknown) => {
        if (controller.signal.aborted) return;
        setConfirmation(null);
        navigate(
          { pathname: paths.login, search: confirmation.search },
          { replace: true },
        );
        toast.error(
          getApiErrorMessage(
            confirmationError,
            "Não foi possível confirmar o email.",
          ),
        );
      });

    return () => controller.abort();
  }, [confirmation, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNeedsConfirmation(false);

    if (mode === "register" && password !== passwordConfirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      await authService[mode === "register" ? "register" : "login"](
        email.trim(),
        password,
      );

      if (mode === "register") {
        setNeedsConfirmation(true);
        toast.success(
          "Conta criada. Confira seu email para confirmar o endereço antes de entrar.",
          { autoClose: 7000 },
        );
        setPassword("");
        setPasswordConfirmation("");
        return;
      }

      const session = await authService.getSession();
      onAuthenticated(session);
      toast.success("Login realizado. Bem-vindo à sua conta.");
    } catch (requestError) {
      const status = isAxiosError(requestError)
        ? requestError.response?.status
        : undefined;
      if (
        (status === 403 && mode === "login") ||
        (status === 503 && mode === "register")
      ) {
        setNeedsConfirmation(true);
      }
      toast.error(
        getApiErrorMessage(requestError, "Não foi possível conectar à API."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resendConfirmation = async () => {
    setSubmitting(true);
    try {
      await authService.resendConfirmation(email.trim());
      toast.success(
        "Se a conta existir e precisar de confirmação, um novo link será enviado.",
      );
    } catch (requestError) {
      toast.error(
        getApiErrorMessage(requestError, "Não foi possível reenviar o email."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    navigate(nextMode === "register" ? paths.register : paths.login, {
      state: location.state,
    });
    setPassword("");
    setPasswordConfirmation("");
    setNeedsConfirmation(false);
  };

  return {
    mode,
    email,
    setEmail,
    password,
    setPassword,
    passwordConfirmation,
    setPasswordConfirmation,
    needsConfirmation,
    submitting,
    submit,
    resendConfirmation,
    switchMode,
  };
}
