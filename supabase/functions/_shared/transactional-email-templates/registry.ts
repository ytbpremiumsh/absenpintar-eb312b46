import * as React from 'npm:react@18.3.1'
import { template as adminSupportTicket } from './admin-support-ticket.tsx'
import { template as registerWelcome } from './register-welcome.tsx'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-support-ticket': adminSupportTicket,
  'register-welcome': registerWelcome,
}
