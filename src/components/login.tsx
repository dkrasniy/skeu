"use client";

import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft01Icon, GoogleIcon, Mail01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "./controls";
import { Button } from "./button";
import { Dialog, fitTo, touch } from "./dialog";
import { Field } from "./field";

// A test login flow (nothing is sent anywhere; not shown in the app yet), built to try Family ConnectKit's nested-page transition:
// the box resizes from its center while the old page fades out in place and the new one fades in, scaling
// up from .97. The close button and header stay put; only the title crossfades and the back arrow fades.

type Page = "start" | "email" | "google" | "signup" | "sent";
const TITLES: Record<Page, string> = { start: "Log in", email: "Continue with email", google: "Google", signup: "Create an account", sent: "Check your email" };
const LEAVE_MS = 150;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = { name?: string; email?: string };
// Checks a form and focuses the first field that's wrong. Messages say what to do, not what went wrong.
function check(form: HTMLFormElement, values: { name?: string; email: string }): Errors | null {
  const errors: Errors = {};
  if (values.name !== undefined && !values.name.trim()) errors.name = "Enter your name.";
  if (!EMAIL.test(values.email.trim())) errors.email = "Enter an email address like name@example.com.";
  const first = Object.keys(errors)[0];
  if (!first) return null;
  (form.elements.namedItem(first) as HTMLInputElement | null)?.focus();
  return errors;
}

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [stack, setStack] = useState<Page[]>(["start"]);
  const [leaving, setLeaving] = useState<Page | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const sendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const page = stack[stack.length - 1];

  useLayoutEffect(() => {
    const b = box.current;
    const content = b?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!b || !content) return;
    // No scrolling: the box is still the old page's size, so the browser would scroll it to reach the control.
    if (leaving && !touch()) content.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    return fitTo(b, content, true);
  }, [page, leaving]);

  function show(next: Page[]) {
    setErrors({});
    setLeaving(page);
    setStack(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(null), LEAVE_MS);
  }
  const go = (to: Page) => show([...stack, to]);
  const back = () => { stopSending(); if (stack.length > 1) show(stack.slice(0, -1)); };
  // A short wait on the button (no request is made in this test) before moving on to "Check your email".
  function send() {
    setSending(true);
    sendTimer.current = setTimeout(() => { setSending(false); go("sent"); }, 500);
  }
  function stopSending() { clearTimeout(sendTimer.current); setSending(false); }

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    clearTimeout(sendTimer.current);
    setSending(false);
    setStack(["start"]);
    setLeaving(null);
    setName("");
    setEmail("");
    setErrors({});
    box.current?.style.removeProperty("height");
    box.current?.style.removeProperty("width");
  }, []);

  const pages: Record<Page, ReactNode> = {
    start: <>
      <button type="button" className="login-option" data-autofocus onClick={() => go("google")}><Icon icon={GoogleIcon} />Continue with Google</button>
      <button type="button" className="login-option" onClick={() => go("email")}><Icon icon={Mail01Icon} />Continue with email</button>
      <p className="login-note">New to Skeu? <button type="button" className="login-link" onClick={() => go("signup")}>Create an account</button></p>
      <p className="login-fine">By continuing you agree to the terms of service and the privacy policy. Your screenshots stay on your device either way.</p>
    </>,
    email: <form noValidate onSubmit={e => { e.preventDefault(); const found = check(e.currentTarget, { email }); if (found) setErrors(found); else send(); }}>
      <Field label="Email" name="email" type="email" data-autofocus placeholder="you@example.com" value={email} error={errors.email}
        onChange={e => { setEmail(e.target.value); setErrors({}); }} />
      <Button type="submit" variant="primary" size="large" rounded={false} loading={sending}>Send a login link</Button>
    </form>,
    google: <>
      <span className="login-spinner" aria-hidden="true" />
      <p className="login-lead"><b>Waiting for Google</b>Finish logging in in the window that opened.</p>
      <Button size="large" rounded={false} data-autofocus onClick={back}>Cancel</Button>
    </>,
    signup: <form noValidate onSubmit={e => { e.preventDefault(); const found = check(e.currentTarget, { name, email }); if (found) setErrors(found); else send(); }}>
      <Field label="Name" name="name" type="text" data-autofocus autoComplete="name" value={name} error={errors.name}
        onChange={e => { setName(e.target.value); setErrors(({ email: other }) => ({ email: other })); }} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} error={errors.email}
        onChange={e => { setEmail(e.target.value); setErrors(({ name: other }) => ({ name: other })); }} />
      <Button type="submit" variant="primary" size="large" rounded={false} loading={sending}>Create account</Button>
      <p className="login-note">Already have an account? <button type="button" className="login-link" onClick={() => show(["start"])}>Log in</button></p>
    </form>,
    sent: <>
      <span className="login-badge" aria-hidden="true"><Icon icon={Mail01Icon} size={20} /></span>
      <p className="login-lead">We sent a link to <b className="inline">{email || "your inbox"}</b>. Open it on this device to finish.</p>
      <Button size="large" rounded={false} data-autofocus onClick={back}>Use a different email</Button>
    </>,
  };

  const shown = leaving && leaving !== page ? [leaving, page] : [page];

  return <Dialog open={open} onClose={onClose} onClosed={reset} labelledBy="login-title" className="login">
    <header className="login-head">
      <button type="button" className={`icon-button login-back ${stack.length > 1 ? "is-shown" : ""}`} aria-label="Back" inert={stack.length < 2} onClick={back}>
        <Icon icon={ArrowLeft01Icon} /></button>
      <h2 id="login-title" className="login-title">
        {shown.map(p => <span key={p} className={p === leaving && p !== page ? "dissolve-out" : leaving ? "dissolve-in" : undefined}
          aria-hidden={p !== page}>{TITLES[p]}</span>)}
      </h2>
    </header>
    <div ref={box} className="login-box t-resize">
      {shown.map(p => <section key={p} data-page={p} className={`login-page ${p === leaving && p !== page ? "dissolve-out" : leaving ? "dissolve-in" : ""}`}
        inert={p !== page} aria-hidden={p !== page}>{pages[p]}</section>)}
    </div>
  </Dialog>;
}
