import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the color for a model provider based on system name
 */
export function getModelColor(system: string): string {
  const systemLower = system.toLowerCase();

  if (systemLower === 'droyd') {
    return '#DEB67C';
  }

  if (systemLower.includes('gpt') || systemLower.includes('openai')) {
    return '#4285F4';
  }

  if (systemLower.includes('gemini') || systemLower.includes('google')) {
    return '#34A853';
  }

  if (systemLower.includes('claude') || systemLower.includes('anthropic')) {
    return '#CD9B7A';
  }

  // Default fallback
  return 'hsl(var(--chart-1))';
}
