"use client";

import { useState } from "react";
import { cn } from "./ui";

/**
 * Quantity entry as cases + pieces. Submits the total pieces in a hidden input `name`.
 * When caseSize is 1 only the pieces box is shown.
 */
export function QtyInput({
  name,
  caseSize,
  unit = "pc",
  defaultValue = 0,
  max,
  onChange,
  className,
  compact,
}: {
  name?: string;
  caseSize: number;
  unit?: string;
  defaultValue?: number;
  max?: number;
  onChange?: (pieces: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const cs0 = caseSize > 1 ? Math.floor(defaultValue / caseSize) : 0;
  const [cs, setCs] = useState(String(cs0 || ""));
  const [pc, setPc] = useState(String(defaultValue - cs0 * caseSize || ""));
  const total = (parseInt(cs || "0", 10) || 0) * (caseSize > 1 ? caseSize : 0) + (parseInt(pc || "0", 10) || 0);
  const over = max != null && total > max;

  function update(nextCs: string, nextPc: string) {
    setCs(nextCs);
    setPc(nextPc);
    const t = (parseInt(nextCs || "0", 10) || 0) * (caseSize > 1 ? caseSize : 0) + (parseInt(nextPc || "0", 10) || 0);
    onChange?.(t);
  }

  const box = cn(
    "input text-right tabular-nums",
    compact ? "h-8 w-14 px-2 text-sm" : "h-10 w-16",
    over && "border-red-400 bg-red-50",
  );
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {caseSize > 1 && (
        <>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={cs}
            placeholder="0"
            aria-label="Cases"
            onChange={(e) => update(e.target.value, pc)}
            className={box}
          />
          <span className="text-xs text-gray-500">cs</span>
        </>
      )}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={pc}
        placeholder="0"
        aria-label={unit}
        onChange={(e) => update(cs, e.target.value)}
        className={box}
      />
      <span className="text-xs text-gray-500">{unit}</span>
      {name && <input type="hidden" name={name} value={total} />}
    </div>
  );
}
