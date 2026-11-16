"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track, type TrackedEvent } from "@/features/analytics/track";

type Props = ComponentProps<typeof Link> & { event: TrackedEvent; where: string };

/** Link que registra um evento de funil (só se a pessoa aceitou a medição). */
export function TrackedLink({ event, where, onClick, ...props }: Props) {
  return <Link {...props} onClick={(e) => { track(event, { onde: where }); onClick?.(e); }} />;
}
