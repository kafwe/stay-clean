export interface ThemeCleanerColor {
  hex: string
  label: string
}

export const THEME_CLEANER_COLORS: ThemeCleanerColor[] = [
  { hex: '#7ea8f8', label: 'Powder Blue' },
  { hex: '#84d8c8', label: 'Seafoam' },
  { hex: '#f3a1ae', label: 'Rose' },
  { hex: '#b7a0f4', label: 'Lavender' },
  { hex: '#f3c889', label: 'Apricot' },
  { hex: '#8bc9ea', label: 'Sky Mist' },
  { hex: '#e2a4d3', label: 'Orchid' },
  { hex: '#b7d88a', label: 'Pistachio' },
]

const allowedThemeCleanerColorSet = new Set(
  THEME_CLEANER_COLORS.map((color) => color.hex.toLocaleLowerCase()),
)

export function normalizeCleanerColorHex(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return value.trim().toLocaleLowerCase()
}

export function isThemeCleanerColor(value: string | null | undefined) {
  const normalized = normalizeCleanerColorHex(value)
  return normalized ? allowedThemeCleanerColorSet.has(normalized) : false
}
