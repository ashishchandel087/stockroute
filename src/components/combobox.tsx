"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./ui";

export type Option = { id: string; label: string; sub?: string; search?: string };

/** Type-to-search picker that scales to thousands of options. Submits the chosen id as `name`. */
export function Combobox({
  options,
  name,
  placeholder = "Search…",
  defaultId,
  value,
  onSelect,
  required,
  className,
}: {
  options: Option[];
  name?: string;
  placeholder?: string;
  defaultId?: string;
  value?: string;
  onSelect?: (o: Option | null) => void;
  required?: boolean;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultId ?? "");
  const id = value ?? selectedId;
  const selected = options.find((o) => o.id === id) ?? null;
  const [text, setText] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // When the selection changes from outside (controlled `value`), show its label
  const [shownId, setShownId] = useState(id);
  if (id !== shownId) {
    setShownId(id);
    if (selected) setText(selected.label);
  }

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const matches = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || (selected && text === selected.label)) return options.slice(0, 40);
    return options
      .filter((o) => {
        const hay = (o.search ?? `${o.label} ${o.sub ?? ""}`).toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 40);
  }, [text, options, selected]);

  function choose(o: Option) {
    setSelectedId(o.id);
    setText(o.label);
    setOpen(false);
    onSelect?.(o);
  }

  return (
    <div ref={box} className={cn("relative", className)}>
      <input
        value={text}
        placeholder={placeholder}
        required={required && !id}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHi(0);
          if (selectedId) {
            setSelectedId("");
            onSelect?.(null);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && open && matches[hi]) {
            e.preventDefault();
            choose(matches[hi]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="input h-10"
      />
      {name && <input type="hidden" name={name} value={id} />}
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {matches.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                onMouseEnter={() => setHi(i)}
                className={cn("block w-full px-3 py-1.5 text-left text-sm", i === hi && "bg-brand-50")}
              >
                <div className="font-medium text-gray-900">{o.label}</div>
                {o.sub && <div className="text-xs text-gray-500">{o.sub}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
