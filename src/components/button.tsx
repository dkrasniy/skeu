import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The one button. `href` makes it a link; `arrow` adds a trailing chevron that opens into an arrow on hover
// (transitions.dev "Learn more hover"), for buttons that take you somewhere. Buttons are pills; `rounded={false}`
// gives squarer corners, for full-width actions in dialogs and forms. `loading` fades the label out (it keeps its
// space, so the button doesn't change size), shows a spinner over the middle, and ignores clicks until it's done.

type Variant = "primary" | "secondary" | "ghost";
type Common = { variant?: Variant; size?: "large"; rounded?: boolean; arrow?: boolean; loading?: boolean; className?: string; children: ReactNode };
type Props = Common & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, keyof Common | "href">)
  | ({ href?: undefined } & Omit<ComponentProps<"button">, keyof Common>)
);

export function Button({ variant = "secondary", size, rounded = true, arrow, loading, className = "", children, ...rest }: Props) {
  const classes = ["button", variant, size, !rounded && "square", arrow && "t-learn", className].filter(Boolean).join(" ");
  let content = <>{children}{arrow && <Arrow />}</>;
  // Buttons that can load wrap their label, so it can fade while the spinner sits on top.
  if (loading !== undefined) content = <><span className="button-label">{content}</span>{loading && <span className="button-spinner" aria-hidden="true" />}</>;
  if (rest.href !== undefined) return <Link {...rest} className={classes}>{content}</Link>;
  const { onClick, ...button } = rest;
  return <button type="button" {...button} className={classes} aria-busy={loading || undefined}
    onClick={loading ? e => e.preventDefault() : onClick}>{content}</button>;
}

export function Arrow() {
  return <span className="t-learn-chevron" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" />
      <path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" />
    </svg>
  </span>;
}
