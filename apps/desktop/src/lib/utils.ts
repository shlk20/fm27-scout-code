import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatValue(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("en-US");
}

export function formatWage(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("en-US")}/周`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function caTone(ca: number): string {
  if (ca >= 170) return "text-[var(--gold)] bg-[var(--gold-soft)] border-[var(--gold-line)]";
  if (ca >= 140) return "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent-line)]";
  if (ca >= 110) return "text-[var(--blue)] bg-[var(--blue-soft)] border-[var(--blue-line)]";
  return "text-[var(--muted)] bg-[var(--surface-2)] border-[var(--line)]";
}

export function attributeTone(value: number): string {
  if (value >= 16) return "bg-[var(--gold)] text-[#221b0b]";
  if (value >= 13) return "bg-[var(--accent)] text-white";
  if (value >= 10) return "bg-[var(--accent-soft)] text-[var(--accent-strong)]";
  if (value >= 7) return "bg-[var(--surface-3)] text-[var(--muted)]";
  return "bg-[var(--danger-soft)] text-[var(--danger)]";
}

export function attributeBar(value: number, max = 20): string {
  const pct = Math.max(4, Math.min(100, (value / max) * 100));
  return `${pct}%`;
}

export function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
