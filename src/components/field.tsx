"use client";

import { type ComponentProps, useId } from "react";

// The one text field: a label, the input, and an error that folds open under it.
// The input is drawn with a single inset line: a muted 1px at rest (mixed from the text color, so it suits light
// and dark surfaces alike), 2px in the brand color on focus, and red when `error` is set.
export function Field({ label, error, className = "", ...input }: { label: string; error?: string } & Omit<ComponentProps<"input">, "aria-invalid">) {
  const id = useId();
  return <div className={`field ${className}`} data-invalid={error ? "" : undefined}>
    <label className="field-label" htmlFor={id}>{label}</label>
    <input {...input} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />
    <div className="field-message"><p id={`${id}-error`} role={error ? "alert" : undefined}>{error}</p></div>
  </div>;
}
