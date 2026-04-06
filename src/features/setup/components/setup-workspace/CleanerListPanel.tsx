import type { UseFormRegisterReturn } from 'react-hook-form'
import type { Cleaner } from '#/lib/types'
import { THEME_CLEANER_COLORS } from '#/lib/cleaner-colors'

export function CleanerListPanel({
  cleaners,
  active,
  busyKey,
  editingCleanerId,
  editingCleanerNameError,
  editingCleanerColorError,
  selectedEditingCleanerColor,
  editingCleanerNameTrimmed,
  editingCleanerNameAlreadyExists,
  editNameInputProps,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onEditColorSelect,
  onSaveEdit,
  onDeleteCleaner,
}: {
  cleaners: Cleaner[]
  active: boolean
  busyKey: string | null
  editingCleanerId: string | null
  editingCleanerNameError?: string
  editingCleanerColorError?: string
  selectedEditingCleanerColor: string
  editingCleanerNameTrimmed: string
  editingCleanerNameAlreadyExists: boolean
  editNameInputProps: UseFormRegisterReturn
  onToggle: () => void
  onStartEdit: (cleaner: Cleaner) => void
  onCancelEdit: () => void
  onEditColorSelect: (colorHex: string) => void
  onSaveEdit: (cleaner: Cleaner) => void
  onDeleteCleaner: (cleaner: Cleaner) => void
}) {
  return (
    <article className="fold-panel setup-summary-panel">
      <div className="setup-summary-head">
        <div>
          <p className="section-title">Current cleaners</p>
          <p className="setup-summary-copy">Keep the active team list current.</p>
        </div>
        <button type="button" className={active ? 'action-ghost' : 'action-secondary'} onClick={onToggle}>
          {active ? 'Close drawer' : 'Add a cleaner'}
        </button>
      </div>

      {cleaners.length ? (
        <div className="home-list-grid setup-summary-list">
          {cleaners.map((cleaner) => {
            const isEditing = editingCleanerId === cleaner.id
            const isUpdating = busyKey === `update-cleaner-${cleaner.id}`
            const isDeleting = busyKey === `delete-cleaner-${cleaner.id}`

            return (
              <article key={cleaner.id} className={`home-card cleaner-card ${isEditing ? 'is-editing' : ''}`}>
                <div className="cleaner-entry-main">
                  <span className="cleaner-chip">
                    <span
                      className="cleaner-dot"
                      style={{ backgroundColor: cleaner.colorHex ?? '#7ea8f8' }}
                      aria-hidden="true"
                    />
                    {cleaner.name}
                  </span>

                  {isEditing ? (
                    <div className="cleaner-edit-wrap">
                      {editingCleanerNameError ? (
                        <p className="text-xs text-[var(--accent-deep)]">{editingCleanerNameError}</p>
                      ) : null}
                      <input
                        className="field cleaner-edit-input"
                        {...editNameInputProps}
                        autoFocus
                        aria-invalid={editingCleanerNameError ? 'true' : undefined}
                      />

                      <div className="space-y-2">
                        <p className="section-title">Color</p>
                        <div className="theme-color-grid" role="radiogroup" aria-label="Cleaner color">
                          {THEME_CLEANER_COLORS.map((color) => {
                            const isSelected =
                              selectedEditingCleanerColor.toLocaleLowerCase() ===
                              color.hex.toLocaleLowerCase()

                            return (
                              <button
                                key={color.hex}
                                type="button"
                                className={`theme-color-swatch ${isSelected ? 'is-selected' : ''}`}
                                style={{ backgroundColor: color.hex }}
                                onClick={() => onEditColorSelect(color.hex)}
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={color.label}
                                title={color.label}
                                disabled={isUpdating}
                              />
                            )
                          })}
                        </div>
                        {editingCleanerColorError ? (
                          <p className="text-xs text-[var(--accent-deep)]">{editingCleanerColorError}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={`cleaner-entry-actions ${isEditing ? 'is-editing' : ''}`}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="cleaner-action-button cleaner-action-save"
                        disabled={isUpdating || editingCleanerNameTrimmed.length < 2 || editingCleanerNameAlreadyExists}
                        onClick={() => onSaveEdit(cleaner)}
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="cleaner-action-button cleaner-action-cancel"
                        disabled={isUpdating}
                        onClick={onCancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="cleaner-action-button cleaner-action-edit"
                        disabled={isDeleting}
                        onClick={() => onStartEdit(cleaner)}
                      >
                        Edit details
                      </button>
                      <button
                        type="button"
                        className="cleaner-action-button cleaner-action-delete"
                        disabled={isDeleting}
                        onClick={() => onDeleteCleaner(cleaner)}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="text-sm leading-6 text-[var(--ink-soft)]">No cleaners added yet.</p>
      )}
    </article>
  )
}
