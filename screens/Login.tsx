import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import { Button, Field, Input } from "../components/ui";

export default function Login() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const [resetHelp, setResetHelp] = useState(false);
  const demos = ["u-admin", "u-meera", "u-rahul"].map((id) => state.users.find((u) => u.id === id)).filter((u) => !!u);
  const submit = () => {
    setError("");
    if (!email.trim()) { setError("Enter your email"); return; }
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) { setError("No staff account uses this email"); return; }
    if (!password) { setError("Enter your password"); return; }
    actions.signIn(user.id);
    navigate(user.role === "admin" ? "/admin" : "/teacher");
  };
  return <main className="min-h-screen bg-surface lg:grid lg:grid-cols-2">
    <section className="flex min-h-0 flex-col justify-between bg-charcoal px-5 py-5 text-on-charcoal sm:px-10 sm:py-8 lg:min-h-screen lg:px-14 lg:py-12">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-on-primary">GP</span><span className="text-sm font-semibold">{state.settings.schoolName}</span></div>
      <div className="my-5 lg:my-auto lg:py-14"><p className="text-xs font-medium uppercase tracking-[0.14em] text-on-charcoal-2">Exam evaluation</p><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Examination workflow</h1><ol className="mt-7 space-y-3 text-sm text-on-charcoal-2"><li>1. Set up the paper, key and rubric</li><li>2. Upload scanned booklets</li><li>3. Review AI marks</li><li>4. Verify and release</li></ol></div>
      <p className="hidden text-xs text-on-charcoal-2 lg:block">Staff access · {state.settings.academicYear}</p>
    </section>
    <section className="flex items-center justify-center px-5 py-8 sm:px-10 lg:px-14"><div className="w-full max-w-md">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Staff sign in</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Welcome back</h2><p className="mt-1 text-sm text-ink-3">Use your school staff account to continue.</p>
      <form className="mt-7 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Email" htmlFor="login-email" error={error === "Enter your email" || error === "No staff account uses this email" ? error : undefined}><Input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {!forgot && <Field label="Password" htmlFor="login-password" error={error === "Enter your password" ? error : undefined}><Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>}
        {error && error !== "Enter your email" && error !== "No staff account uses this email" && error !== "Enter your password" && <p role="alert" className="text-xs text-danger">{error}</p>}
        {resetHelp && <p className="rounded-md border border-border bg-subtle px-3 py-2.5 text-[13px] text-ink-2">Ask the Exam Cell to reset your password</p>}
        <div className="flex items-center justify-between"><button type="button" onClick={() => { setForgot((v) => !v); setResetHelp(!forgot); setError(""); }} className="text-[13px] font-medium text-primary hover:underline">{forgot ? "Back to sign in" : "Forgot password?"}</button></div>
        {!forgot && <Button type="submit" variant="primary" className="w-full">Sign in</Button>}
      </form>
      <div className="mt-7 border-t border-border pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Demo accounts</p><ul className="mt-2 divide-y divide-border rounded-md border border-border">{demos.map((u) => <li key={u!.id}><button className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-subtle" onClick={() => { setEmail(u!.email); setPassword("demo"); setError(""); }}><span className="text-[13px] font-medium text-ink">{u!.name}<span className="ml-2 font-normal text-ink-3">· {u!.title}</span></span><span className="text-xs text-primary">Use</span></button></li>)}</ul><p className="mt-4 text-xs leading-relaxed text-ink-3">Students and guardians open results from the link in their SMS.</p></div>
    </div></section>
  </main>;
}
