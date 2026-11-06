import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../data/store";
import { now } from "../data/selectors";
import { PublicFrame } from "../components/Shell";
import { Button, EmptyState, Field, Input } from "../components/ui";
import ResultDocument from "../components/ResultDocument";
import { useScreenInit } from "../useScreenInit";

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "the registered number";
  const digits = phone.replace(/\D/g, "");
  return `${phone.startsWith("+") ? "+91 " : ""}${digits.slice(-10, -8)}••• ••${digits.slice(-3)}`;
}

export default function ParentResult() {
  const { token } = useParams();
  const { state, actions } = useStore();
  const init = useScreenInit();
  const distribution = state.distributions.find((d) => d.token === token);
  const revoked = !!distribution?.revoked;
  const expired = !!distribution && new Date(distribution.expiresAt).getTime() < now();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(!!init.skipOtp);
  const opened = useRef(false);
  const sheet = distribution && state.sheets.find((s) => s.id === distribution.sheetId);
  const student = distribution && state.students.find((s) => s.id === distribution.studentId);
  const assessment = distribution && state.assessments.find((a) => a.id === distribution.assessmentId);
  useEffect(() => {
    if (verified && distribution && !opened.current) {
      opened.current = true;
      actions.recordOpen(distribution.token);
    }
  }, [verified, distribution?.token, actions]);
  if (!distribution || !sheet || !student || !assessment) return <PublicFrame><main className="mx-auto max-w-xl px-4 py-16"><EmptyState title="This link isn't valid" body="Check the SMS or contact the school." /></main></PublicFrame>;
  return <PublicFrame><header className="border-b border-border bg-surface"><div className="mx-auto max-w-[900px] px-4 py-3 sm:px-6"><p className="text-sm font-semibold text-ink">{state.settings.schoolName}</p>{verified && <p className="mt-0.5 text-xs text-ink-3">Result for {student.name}</p>}</div></header><main className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 sm:py-8">
    {revoked ? <EmptyState title="This link was turned off by the school" body="Contact the Examination Cell for help." /> : expired ? <EmptyState title="This link has expired" body="Contact the Examination Cell for a new link." /> : verified ? <ResultDocument sheet={sheet} distribution={distribution} audience="guardian" assessment={assessment} student={student} schoolName={state.settings.schoolName} users={state.users} /> : <section className="mx-auto max-w-md rounded-lg border border-border bg-surface p-5 shadow-xs sm:p-7"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Secure result access</p><h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">Confirm your phone</h1><p className="mt-2 text-sm leading-relaxed text-ink-3">Enter the 6-digit code sent to {maskPhone(distribution.phone ?? student.guardian.phone)}.</p><form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code from the SMS"); return; } setError(""); setVerified(true); }}><Field label="6-digit code" htmlFor="otp-code" error={error}><Input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} /></Field><Button type="submit" variant="primary" className="w-full">View result</Button></form><button type="button" onClick={() => actions.toast("Code sent")} className="mt-4 text-sm font-medium text-primary hover:underline">Resend code</button></section>}
  </main></PublicFrame>;
}
