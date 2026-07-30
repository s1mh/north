"use client";

import { useState } from "react";
import type { ThemePreference } from "@/features/profile/theme";

const choices: Array<{ value: ThemePreference; label: string; hint: string }> = [
  { value: "system", label: "Sistema", hint: "acompanha o aparelho" },
  { value: "light", label: "Claro", hint: "fundo areia" },
  { value: "dark", label: "Escuro", hint: "menos brilho" },
];

export function ThemeControl({ initialTheme }: { initialTheme: ThemePreference }) {
  const [theme, setTheme] = useState(initialTheme);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function choose(nextTheme: ThemePreference) {
    if (pending || nextTheme === theme) return;
    const previous = theme;
    setTheme(nextTheme);
    setPending(true);
    setError("");
    document.documentElement.dataset.theme = nextTheme;
    const response = await fetch("/api/profile/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: nextTheme }),
    }).catch(() => null);
    if (!response?.ok) {
      setTheme(previous);
      document.documentElement.dataset.theme = previous;
      setError("Não foi possível salvar o tema agora.");
    }
    setPending(false);
  }

  return <section className="profile-theme" aria-labelledby="theme-title">
    <div className="section-head">
      <div><p className="eyebrow">Aparência</p><h2 id="theme-title">Tema</h2></div>
    </div>
    <div className="theme-options">
      {choices.map((choice) => <button
        type="button"
        data-selected={theme === choice.value}
        aria-pressed={theme === choice.value}
        disabled={pending}
        key={choice.value}
        onClick={() => choose(choice.value)}
      >
        <strong>{choice.label}</strong>
        <small>{choice.hint}</small>
      </button>)}
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </section>;
}
