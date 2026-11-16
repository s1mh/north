"use client";

import { useEffect, useId, useRef, useState } from "react";

const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function parse(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
}

function display(value: string) {
  const parts = parse(value);
  return parts ? `${String(parts.d).padStart(2, "0")}/${String(parts.m + 1).padStart(2, "0")}/${parts.y}` : "";
}

function shift(value: string, days: number) {
  const parts = parse(value);
  if (!parts) return value;
  const date = new Date(Date.UTC(parts.y, parts.m, parts.d + days));
  return iso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

type Props = {
  label: string;
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
  /** Data de hoje (America/Sao_Paulo), usada nos atalhos "Hoje" e "Ontem". */
  today?: string;
  /** Mostra o botão "Limpar data" (campos opcionais). */
  clearable?: boolean;
};

export function DateField({ label, name, defaultValue = "", min, max, required, today, clearable }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const now = new Date();
  const start = parse(value) ?? parse(max) ?? parse(today) ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [view, setView] = useState({ y: start.y, m: start.m });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const allowed = (candidate: string) => (!min || candidate >= min) && (!max || candidate <= max);
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(view.y, view.m, 1)));

  function move(delta: number) {
    const date = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: date.getUTCFullYear(), m: date.getUTCMonth() });
  }

  function pick(next: string) {
    if (!allowed(next)) return;
    setValue(next);
    const parts = parse(next);
    if (parts) setView({ y: parts.y, m: parts.m });
    setOpen(false);
  }

  const yesterday = today ? shift(today, -1) : "";

  return <div className="auth-field date-field" ref={root}>
    <span id={`${id}-label`}>{label}</span>
    <button
      type="button"
      className="date-trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-labelledby={`${id}-label ${id}-value`}
      onClick={(event) => {
        // Sem espaço embaixo (formulário no fim da tela), o calendário abre para cima.
        const rect = event.currentTarget.getBoundingClientRect();
        setUp(window.innerHeight - rect.bottom < 380 && rect.top > 380);
        setOpen((current) => !current);
      }}
    >
      <b id={`${id}-value`} data-empty={!value}>{value ? display(value) : "Escolher data"}</b>
      <i aria-hidden="true">▾</i>
    </button>
    {/* Campo real do formulário; também faz a validação nativa de "obrigatório". */}
    <input className="date-native" name={name} value={value} required={required} readOnly tabIndex={-1} aria-hidden="true" />

    {open && <div className="date-popover" data-up={up} role="dialog" aria-label={`Escolher ${label.toLowerCase()}`}>
      <div className="date-head">
        <span className="date-nav">
          <button type="button" onClick={() => move(-12)} aria-label="Ano anterior">«</button>
          <button type="button" onClick={() => move(-1)} aria-label="Mês anterior">‹</button>
        </span>
        <strong>{monthLabel}</strong>
        <span className="date-nav">
          <button type="button" onClick={() => move(1)} aria-label="Próximo mês">›</button>
          <button type="button" onClick={() => move(12)} aria-label="Próximo ano">»</button>
        </span>
      </div>
      <div className="date-grid" role="grid">
        {weekdays.map((day, index) => <span className="date-wd" key={`${day}-${index}`} aria-hidden="true">{day}</span>)}
        {cells.map((day, index) => {
          if (day === null) return <span key={`gap-${index}`} />;
          const candidate = iso(view.y, view.m, day);
          const ok = allowed(candidate);
          return <button
            type="button"
            key={candidate}
            disabled={!ok}
            data-selected={candidate === value}
            data-today={candidate === today}
            aria-pressed={candidate === value}
            onClick={() => pick(candidate)}
          >{day}</button>;
        })}
      </div>
      {clearable && value ? <div className="date-quick">
        <button type="button" onClick={() => { setValue(""); setOpen(false); }}>Limpar data</button>
      </div> : null}
      {today && <div className="date-quick">
        <button type="button" disabled={!allowed(yesterday)} onClick={() => pick(yesterday)}>Ontem</button>
        <button type="button" disabled={!allowed(today)} onClick={() => pick(today)}>Hoje</button>
      </div>}
    </div>}
  </div>;
}
