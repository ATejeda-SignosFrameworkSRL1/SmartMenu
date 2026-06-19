import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases condicionalmente y resuelve conflictos de Tailwind (última gana). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
