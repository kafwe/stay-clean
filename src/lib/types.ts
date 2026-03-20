export type ScheduleStatus = 'draft' | 'confirmed' | 'needs_review'
export type ChangeSource = 'ical' | 'chat'
export type ChangeStatus = 'pending' | 'approved' | 'rejected'
export type TaskType = 'checkout_clean' | 'external_clean' | 'midstay_review'

export interface Apartment {
  id: string
  name: string
  buildingId: string
  address: string
  icalUrl: string | null
  isExternal: boolean
  notes: string | null
}

export interface Cleaner {
  id: string
  name: string
  colorHex: string | null
  isActive: boolean
}

export interface CleanerAvailability {
  cleanerId: string
  date: string
  status: 'available' | 'off'
}

export interface Booking {
  id: string
  apartmentId: string
  externalRef: string | null
  guestName: string | null
  checkIn: string
  checkOut: string
  nights: number
  rawHash: string
}

export interface ManualCleanRequest {
  id: string
  label: string
  apartmentId: string | null
  taskDate: string | null
  weekday: number | null
  isRecurring: boolean
  notes: string | null
  isActive: boolean
}

export interface CleanTask {
  id: string
  apartmentId: string | null
  apartmentName: string
  buildingId: string | null
  taskDate: string
  taskType: TaskType
  notes: string | null
  requiresReview: boolean
}

export interface ScheduleAssignment {
  id: string
  cleanTaskId: string
  apartmentId: string | null
  apartmentName: string
  buildingId: string | null
  taskDate: string
  cleanerId: string | null
  cleanerName: string | null
  sortOrder: number
  source: 'auto' | 'manual' | 'approved_patch'
  notes: string | null
  taskType: TaskType
}

export interface ScheduleRun {
  id: string
  weekStart: string
  status: ScheduleStatus
  summary: string | null
}

export interface ScheduleChange {
  apartmentName: string
  date: string
  beforeCleaner: string | null
  afterCleaner: string | null
  reason: 'added' | 'removed' | 'reassigned'
}

export interface ChangePayload {
  title: string
  summary: string
  tasks: CleanTask[]
  assignments: ScheduleAssignment[]
  changes: ScheduleChange[]
}

export interface ChangeSet {
  id: string
  scheduleRunId: string
  source: ChangeSource
  status: ChangeStatus
  title: string
  summary: string
  payload: ChangePayload
  createdAt: string
}

export interface ManualReviewItem {
  id: string
  apartmentName: string
  checkIn: string
  checkOut: string
  nights: number
  note: string
}

export interface SyncEvent {
  id: string
  syncType: string
  status: string
  details: Record<string, unknown>
  createdAt: string
}

export interface ScheduleDayGroup {
  date: string
  label: string
  rows: ScheduleAssignment[]
  isEmpty: boolean
}

export interface DashboardData {
  authenticated: boolean
  weekStart: string
  weekEnd: string
  weekLabel: string
  weekStatus: ScheduleStatus | null
  lastSyncedAt: string | null
  vapidPublicKey: string | null
  apartments: Apartment[]
  cleaners: Cleaner[]
  dayGroups: ScheduleDayGroup[]
  changeSets: ChangeSet[]
  manualReviews: ManualReviewItem[]
  syncSummary: string
  emptyStateReason: string | null
}

export interface ChatOperation {
  action: 'reassign_day' | 'reassign_apartment' | 'unassign_day'
  weekday?: number
  date?: string
  apartmentName?: string
  fromCleaner?: string
  toCleaner?: string
}

export interface ChatPatchProposal {
  title: string
  summary: string
  operations: ChatOperation[]
}

export interface PushSubscriptionRecord {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}
