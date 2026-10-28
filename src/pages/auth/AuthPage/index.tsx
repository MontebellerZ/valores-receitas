import FormField from "../../../components/ui/FormField";
import Button from "../../../components/ui/Button";
import FormControl from "../../../components/ui/FormControl";
import styles from "./styles.module.scss";
import { useAuthForm } from "../../../hooks/useAuthForm";
import type { UserSession } from "../../../domain/models";
import {
  ArrowRight,
  ChefHat,
  LockKeyhole,
  Mail,
  RefreshCw,
} from "lucide-react";
import logoVertical from "../../../assets/brand/conta-de-chef-vertical.png";


type Props = {
  onAuthenticated: (session: UserSession) => void;
};

export default function Auth({ onAuthenticated }: Props) {
  const {
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
  } = useAuthForm(onAuthenticated);

  return (
    <main className={styles["auth-page"]}>
      <section className={styles["auth-brand-panel"]} aria-label="Conta de Chef">
        <img src={logoVertical} alt="Conta de Chef" width="548" height="309" />
        <div className={styles["auth-brand-rule"]} />
        <span>CONTA DE CHEF</span>
      </section>
      <section className={styles["auth-main"]}>
        <div className={styles["auth-form-wrap"]}>
          <div className={styles["auth-mobile-brand"]}>
            <ChefHat size={22} aria-hidden="true" />
            <span>Conta de Chef</span>
          </div>
          <div className={styles["auth-eyebrow"]}>ESPAÇO DE TRABALHO</div>
          <h1>{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h1>
          <p className={styles["auth-intro"]}>
            {mode === "login"
              ? "Entre para continuar gerenciando seu negócio."
              : "Cadastre seu email para começar sua conta de chef."}
          </p>

          <form className={styles["auth-form"]} onSubmit={submit}>
            <FormField className={styles["auth-field"]} label="Email">
              
              <FormControl
                type="email"
                autoComplete="email"
                required
                maxLength={256}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                controlSize="large"
                prefix={<Mail size={17} aria-hidden="true" />}
              />
            </FormField>
            <FormField className={styles["auth-field"]} label="Senha">
              
              <FormControl
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "register" ? 6 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                controlSize="large"
                prefix={<LockKeyhole size={17} aria-hidden="true" />}
              />
              {mode === "register" && (
                <small>
                  Mínimo de 6 caracteres, com maiúscula, minúscula, número e
                  símbolo.
                </small>
              )}
            </FormField>
            {mode === "register" && (
              <FormField className={styles["auth-field"]} label="Confirme a senha">
                
                <FormControl
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={passwordConfirmation}
                  onChange={(event) =>
                    setPasswordConfirmation(event.target.value)
                  }
                  controlSize="large"
                  prefix={<LockKeyhole size={17} aria-hidden="true" />}
                />
              </FormField>
            )}
            <Button className={styles["auth-submit"]} type="submit" disabled={submitting}>
              {submitting
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
              {!submitting && <ArrowRight size={17} aria-hidden="true" />}
            </Button>
          </form>

          {needsConfirmation && (
            <Button variant="text"
              className={styles["auth-resend"]}
              type="button"
              onClick={resendConfirmation}
              disabled={submitting || !email.trim()}
            >
              <RefreshCw size={15} aria-hidden="true" /> Reenviar confirmação
              por email
            </Button>
          )}
          <div className={styles["auth-switch"]}>
            <span>
              {mode === "login"
                ? "Ainda não tem uma conta?"
                : "Já tem uma conta?"}
            </span>
            <Button variant="text"
              type="button"
              onClick={() =>
                switchMode(mode === "login" ? "register" : "login")
              }
            >
              {mode === "login" ? "Criar conta" : "Entrar"}
            </Button>
          </div>
          <div className={styles["auth-security-note"]}>
            <span /> Conta pessoal protegida por confirmação de email
          </div>
        </div>
      </section>
    </main>
  );
}
