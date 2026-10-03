import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// The one button. `href` makes it a link; `arrow` adds a trailing chevron that opens into an arrow on hover
// (transitions.dev "Learn more hover"), for buttons that take you somewhere.

type Variant = "primary" | "secondary" | "ghost";
type Common = { variant?: Variant; size?: "large"; arrow?: boolean; className?: string; children: ReactNode };
type Props = Common & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, keyof Common | "href">)
  | ({ href?: undefined } & Omit<ComponentProps<"button">, keyof Common>)
);

export function Button({ variant = "secondary", size, arrow, className = "", children, ...rest }: Props) {
  const classes = ["button", variant, size, arrow && "t-learn", className].filter(Boolean).join(" ");
  const content = <>{children}{arrow && <Arrow />}</>;
  if (rest.href !== undefined) return <Link {...rest} className={classes}>{content}</Link>;
  return <button type="button" {...rest} className={classes}>{content}</button>;
}

export function Arrow() {
  return <span className="t-learn-chevron" aria-hidden="true">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" />
      <path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" />
    </svg>
  </span>;
}
