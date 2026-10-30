import { attributeLabel } from "@/lib/labels";
import { useI18n } from "@/lib/useI18n";

export function AttributeRadar({
  values,
  keys,
  max,
}: {
  values: Record<string, number>;
  keys: string[];
  max: number;
}) {
  const { t, locale } = useI18n();
  const size = 176;
  const center = size / 2;
  const radius = 58;
  const count = keys.length;
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio];
  };
  const polygon = keys
    .map((key, index) => point(index, Math.max(0.08, Math.min(1, (values[key] ?? 0) / max))))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return (
    <div className="flex items-center justify-center py-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={t("inspector.radarAria")}
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={keys
              .map((_, index) => point(index, ratio))
              .map(([x, y]) => `${x},${y}`)
              .join(" ")}
            fill="none"
            stroke="var(--line)"
            strokeWidth={1}
          />
        ))}
        {keys.map((_, index) => {
          const [x, y] = point(index, 1);
          return <line key={index} x1={center} y1={center} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />;
        })}
        <polygon
          points={polygon}
          fill="color-mix(in srgb, var(--accent) 22%, transparent)"
          stroke="var(--accent)"
          strokeWidth={1.6}
        />
        {keys.map((key, index) => {
          const [x, y] = point(index, 1.28);
          return (
            <text
              key={key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fill="var(--muted)"
            >
              {attributeLabel(key, locale)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
