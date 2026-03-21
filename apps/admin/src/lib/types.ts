export type GlobalRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER'
export type FieldType = 'TEXT' | 'EMAIL' | 'TEL' | 'DATE' | 'SELECT' | 'TEXTAREA' | 'NUMBER'
export type Status = 'ABSENT' | 'PRESENT' | 'SIGNED'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: GlobalRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserEvent {
  id: string
  userId: string
  eventId: string
  eventRole: GlobalRole | null
  assignedAt: string
  user?: User
  event?: Event
}

export interface Event {
  id: string
  slug: string
  title: string
  subtitle: string | null
  logoEmoji: string
  entitySingular: string
  entityPlural: string
  displayNameTpl: string
  searchFields: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  fields?: FieldDef[]
  document?: DocumentDef | null
  emailConfig?: EmailConfig | null
  _count?: {
    participants: number
  }
  stats?: EventStats
}

export interface EventStats {
  total: number
  absent: number
  present: number
  signed: number
  emailsSent: number
}

export interface FieldDef {
  id: string
  eventId: string
  key: string
  label: string
  type: FieldType
  options: string[]
  editable: boolean
  required: boolean
  displayInList: boolean
  displayOrder: number
  isQrField: boolean
  isEmailField: boolean
}

export interface DocumentDef {
  id: string
  eventId: string
  title: string
  signingLabel: string
  declarationTemplate: string
  noticeSections: NoticeSection[]
  pdfFooterText: string
  signatureWidthMm: number
  signatureHeightMm: number
  signaturePosition: string
}

export interface NoticeSection {
  title: string
  content: string
}

export interface EmailConfig {
  id: string
  eventId: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  fromAddress: string
  fromName: string
  autoSendOnSign: boolean
  allowManualSend: boolean
  subject: string
  bodyTemplate: string
}

export interface Participant {
  id: string
  eventId: string
  qrCode: string
  status: Status
  data: Record<string, unknown>
  signatureData: string | null
  signedAt: string | null
  pdfPath: string | null
  emailSentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ImportResult {
  created: number
  updated: number
  errors: Array<{ row: number; message: string }>
}
