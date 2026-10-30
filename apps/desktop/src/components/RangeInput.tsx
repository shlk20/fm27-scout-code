import { Input, Label } from "./ui";

export function RangeInput({
  label,
  min,
  max,
  onMin,
  onMax,
  step = 1,
  placeholderMin = "最小",
  placeholderMax = "最大",
}: {
  label: string;
  min: number | null;
  max: number | null;
  onMin: (value: number | null) => void;
  onMax: (value: number | null) => void;
  step?: number;
  placeholderMin?: string;
  placeholderMax?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          step={step}
          value={min ?? ""}
          placeholder={placeholderMin}
          onChange={(event) =>
            onMin(event.target.value === "" ? null : Number(event.target.value))
          }
          className="h-8 font-mono text-[11px]"
        />
        <span className="text-[var(--muted)]">–</span>
        <Input
          type="number"
          inputMode="numeric"
          step={step}
          value={max ?? ""}
          placeholder={placeholderMax}
          onChange={(event) =>
            onMax(event.target.value === "" ? null : Number(event.target.value))
          }
          className="h-8 font-mono text-[11px]"
        />
      </div>
    </div>
  );
}
