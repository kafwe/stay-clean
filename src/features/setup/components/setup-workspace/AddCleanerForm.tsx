import type { FormEventHandler } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { THEME_CLEANER_COLORS } from '#/lib/cleaner-colors'

export function AddCleanerForm({
  visible,
  busy,
  canSubmit,
  selectedCleanerColor,
  nameError,
  colorError,
  nameInputProps,
  onColorSelect,
  onSubmit,
}: {
  visible: boolean
  busy: boolean
  canSubmit: boolean
  selectedCleanerColor: string
  nameError?: string
  colorError?: string
  nameInputProps: UseFormRegisterReturn
  onColorSelect: (hex: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}) {
  if (!visible) {
    return null
  }

  return (
    <form className="fold-panel space-y-3" noValidate onSubmit={onSubmit}>
      <div className="space-y-1">
        <h2 className="section-title">Add a cleaner</h2>
      </div>
      {nameError ? <p className="text-xs text-[var(--accent-deep)]">{nameError}</p> : null}

      <input
        className="field"
        placeholder="Cleaner name"
        {...nameInputProps}
        aria-invalid={nameError ? 'true' : undefined}
      />

      <div className="space-y-2">
        <p className="section-title">Color</p>
        <div className="theme-color-grid" role="radiogroup" aria-label="Cleaner color">
          {THEME_CLEANER_COLORS.map((color) => {
            const isSelected = selectedCleanerColor.toLocaleLowerCase() === color.hex.toLocaleLowerCase()

            return (
              <button
                key={color.hex}
                type="button"
                className={`theme-color-swatch ${isSelected ? 'is-selected' : ''}`}
                style={{ backgroundColor: color.hex }}
                onClick={() => onColorSelect(color.hex)}
                role="radio"
                aria-checked={isSelected}
                aria-label={color.label}
                title={color.label}
              />
            )
          })}
        </div>
      </div>

      {colorError ? <p className="text-xs text-[var(--accent-deep)]">{colorError}</p> : null}

      <button type="submit" className="action-secondary" disabled={!canSubmit}>
        {busy ? 'Saving...' : 'Add cleaner'}
      </button>
    </form>
  )
}
