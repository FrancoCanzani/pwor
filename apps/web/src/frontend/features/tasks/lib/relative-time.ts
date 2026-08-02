import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";
import { useEffect, useState } from "react";

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";

  const date = new Date(iso);
  const minutes = differenceInMinutes(Date.now(), date);
  if (Number.isNaN(minutes) || minutes < 0) return "";
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = differenceInHours(Date.now(), date);
  if (hours < 48) return `${hours}h`;

  return `${differenceInDays(Date.now(), date)}d`;
}

export function useRelativeTime(iso: string | null | undefined): string {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return relativeTime(iso);
}
