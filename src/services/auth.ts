import type { UserSession } from "../domain/models";
import { api } from "./http";

export const authService = {
  async getSession(signal?: AbortSignal) {
    const { data } = await api.get<UserSession>("/auth/session", { signal });
    return data;
  },
  register(email: string, password: string) {
    return api.post("/auth/register", { email, password });
  },
  login(email: string, password: string) {
    return api.post("/auth/login", { email, password });
  },
  confirmEmail(userId: string, token: string, signal?: AbortSignal) {
    return api.post("/auth/confirm-email", { userId, token }, { signal });
  },
  resendConfirmation(email: string) {
    return api.post("/auth/resend-confirmation", { email });
  },
  logout() {
    return api.post("/auth/logout");
  },
};
