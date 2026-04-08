import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Book, ArrowRight, CheckCircle, AlertCircle, Loader2, Mail } from "lucide-react";

type AuthMode = "login" | "register" | "verify";

export function Login() {
  const { login, register, verify } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.success) {
      window.location.reload();
    } else if (result.needsVerification && result.verificationToken) {
      setVerificationToken(result.verificationToken);
      setMode("verify");
    } else {
      setError(result.error || "Login failed");
    }

    setIsSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await register({ email, password, firstName, lastName });

    if (result.success && result.verificationToken) {
      setVerificationToken(result.verificationToken);
      setMode("verify");
    } else {
      setError(result.error || "Registration failed");
    }

    setIsSubmitting(false);
  };

  const handleVerify = async () => {
    if (!verificationToken) return;
    setError("");
    setIsSubmitting(true);

    const result = await verify(verificationToken);

    if (result.success) {
      setVerificationSuccess(true);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      setError(result.error || "Verification failed");
    }

    setIsSubmitting(false);
  };

  const switchToRegister = () => {
    setMode("register");
    setError("");
  };

  const switchToLogin = () => {
    setMode("login");
    setError("");
    setVerificationToken(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-background selection:bg-primary/20">
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-10">

          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Book className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground">
              Briefly
            </h1>
            <p className="text-lg text-muted-foreground max-w-[280px]">
              A quiet, thoughtful space for collecting and organizing your notes.
            </p>
          </div>

          {mode === "verify" ? (
            <div className="bg-card border border-card-border rounded-2xl p-8 shadow-sm space-y-6">
              {verificationSuccess ? (
                <div className="flex flex-col items-center space-y-4 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                  <h2 className="text-xl font-serif font-semibold text-foreground">Email Verified!</h2>
                  <p className="text-sm text-muted-foreground">Redirecting you to your workspace...</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center space-y-3 text-center">
                    <Mail className="w-10 h-10 text-primary" />
                    <h2 className="text-xl font-serif font-semibold text-foreground">Verify Your Email</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Normally we'd send you a verification email, but since this is a demo, click the link below to verify your account:
                    </p>
                  </div>

                  <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-2">Verification link:</p>
                    <button
                      onClick={handleVerify}
                      disabled={isSubmitting}
                      className="text-primary hover:text-primary/80 underline text-sm font-medium transition-colors inline-flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Click here to verify {email}
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    onClick={switchToLogin}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back to sign in
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-2xl p-8 shadow-sm space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  {mode === "login" ? "Welcome back" : "Create an account"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === "login"
                    ? "Sign in to your account"
                    : "Get started with your personal notebook"}
                </p>
              </div>

              <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
                {mode === "register" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                        First name
                      </label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Alice"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                        Last name
                      </label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Chen"
                        className="h-11"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                    required
                    minLength={mode === "register" ? 8 : undefined}
                    className="h-11"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full h-12 text-base font-medium"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {mode === "login" ? "Sign in" : "Create account"}
                  {!isSubmitting && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </form>

              <div className="text-center">
                {mode === "login" ? (
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      onClick={switchToRegister}
                      className="text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Sign up
                    </button>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      onClick={switchToLogin}
                      className="text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        Crafted for focused thinking.
      </footer>
    </div>
  );
}
