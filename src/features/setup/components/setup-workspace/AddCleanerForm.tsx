import type { FormEventHandler } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { THEME_CLEANER_COLORS } from '#/lib/cleaner-colors'
import { SheetDialog } from '#/features/week/components/SheetDialog'

export function AddCleanerForm({
  open,
  busy,
  canSubmit,
  onClose,
  selectedCleanerColor,
  nameError,
  colorError,
  nameInputProps,
  onColorSelect,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  canSubmit: boolean
  onClose: () => void
  selectedCleanerColor: string
  nameError?: string
  colorError?: string
  nameInputProps: UseFormRegisterReturn
  onColorSelect: (hex: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
}) {
  return (
    <SheetDialog open={open} onClose={onClose} ariaLabel="Add cleaner" panelClassName="sheet-panel-feature">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Workspace setup</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--ink-strong)]">Add a cleaner</h2>
        </div>
        <button type="button" className="action-ghost sheet-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="mt-5 space-y-4" noValidate onSubmit={onSubmit}>
        {nameError ? <p className="text-xs text-[var(--accent-deep)]">{nameError}</p> : null}

        <input
          className="field"
          placeholder="Cleaner name"
          {...nameInputProps}
          data-autofocus="true"
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

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="action-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="action-primary" disabled={!canSubmit}>
            {busy ? 'Saving...' : 'Add cleaner'}
          </button>
        </div>
      </form>
    </SheetDialog>
  )
}
