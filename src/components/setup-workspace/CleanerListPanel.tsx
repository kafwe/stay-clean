import type { UseFormRegisterReturn } from 'react-hook-form'
import type { Cleaner } from '#/lib/types'

export function CleanerListPanel({
  cleaners,
  active,
  busyKey,
  editingCleanerId,
  editingCleanerNameError,
  editingCleanerNameTrimmed,
  editingCleanerNameAlreadyExists,
  editNameInputProps,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDeleteCleaner,
}: {
  cleaners: Cleaner[]
  active: boolean
  busyKey: string | null
  editingCleanerId: string | null
  editingCleanerNameError?: string
  editingCleanerNameTrimmed: string
  editingCleanerNameAlreadyExists: boolean
  editNameInputProps: UseFormRegisterReturn
  onToggle: () => void
  onStartEdit: (cleaner: Cleaner) => void
  onCancelEdit: () => void
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
          {active ? 'Hide form' : 'Add a cleaner'}
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
                        Edit name
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
