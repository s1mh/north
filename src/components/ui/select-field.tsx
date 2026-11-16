"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type Option<T extends string | number> = { value: T; label: string };

/** Lista de escolha própria (no lugar do dropdown do sistema), com teclado e leitor de tela. */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  align = "left",
  className = "",
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [active, setActive] = useState(selectedIndex);
  const current = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus({ preventScroll: true });
  }, [open]);

  function toggle(button: HTMLButtonElement) {
    if (!open) {
      const rect = button.getBoundingClientRect();
      const needed = Math.min(options.length * 46 + 16, 320);
      setUp(window.innerHeight - rect.bottom < needed && rect.top > needed);
      setActive(selectedIndex);
    }
    setOpen((value) => !value);
  }

  function choose(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active); }
    else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }

  return <div className={`select-field ${className}`} ref={root}>
    <button
      type="button"
      className="select-trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={`${label}: ${current?.label ?? ""}`}
      onClick={(event) => toggle(event.currentTarget)}
    >
      <b>{current?.label}</b><i aria-hidden="true">▾</i>
    </button>
    {open && <ul
      ref={list}
      className="select-list"
      data-up={up}
      data-align={align}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-activedescendant={`${id}-${active}`}
      onKeyDown={onKey}
    >
      {options.map((option, index) => <li
        key={String(option.value)}
        id={`${id}-${index}`}
        role="option"
        aria-selected={option.value === value}
        data-active={index === active}
        onPointerEnter={() => setActive(index)}
        onClick={() => choose(index)}
      >
        <span>{option.label}</span>{option.value === value && <em aria-hidden="true">✓</em>}
      </li>)}
    </ul>}
  </div>;
}
