import { describe, it, expect } from 'vitest'
import { renderTemplate } from '../../shared/template-renderer'
import { renderTemplate as renderInterviewTemplate, type InterviewEmailData } from '../../server/utils/email'
import { renderTemplatePreview } from '../../app/utils/system-templates'
import { SYSTEM_TEMPLATES } from '../../shared/system-templates'
import {
  SCREENING_TEMPLATE_VARIABLES,
  DEFAULT_SCREENING_TEMPLATE,
} from '../../shared/screening-template'

/**
 * There must be exactly one generic {{tag}} regex implementation. Both the
 * server (interview emails) and the app (template preview UI) delegate to
 * `shared/template-renderer.ts` — this file locks that contract down so a
 * future edit can't silently reintroduce a third divergent regex.
 */
describe('shared/template-renderer: generic renderTemplate', () => {
  it('replaces all known screening variables', () => {
    const vars: Record<string, string> = {}
    for (const key of SCREENING_TEMPLATE_VARIABLES) vars[key] = `value-${key}`

    const template = SCREENING_TEMPLATE_VARIABLES.map(k => `{{${k}}}`).join(' ')
    const rendered = renderTemplate(template, vars)

    expect(rendered).toBe(SCREENING_TEMPLATE_VARIABLES.map(k => `value-${k}`).join(' '))
  })

  it('leaves unknown {{tag}} placeholders untouched', () => {
    const rendered = renderTemplate('Hello {{candidateName}}, ref: {{unknownTag}}', {
      candidateName: 'Ada',
    })
    expect(rendered).toBe('Hello Ada, ref: {{unknownTag}}')
  })

  it('returns an empty template unchanged', () => {
    expect(renderTemplate('', { anything: 'x' })).toBe('')
  })

  it('does not match malformed {{}} (empty) tags', () => {
    const rendered = renderTemplate('Empty: {{}} tag', { '': 'should-not-appear' })
    expect(rendered).toBe('Empty: {{}} tag')
  })

  it('handles templates with no tags at all', () => {
    expect(renderTemplate('plain text, no variables here', {})).toBe('plain text, no variables here')
  })
})

describe('app/utils/system-templates: renderTemplatePreview delegates to the shared renderer', () => {
  it('renders known variables the same way as the shared renderer', () => {
    const template = '{{jobTitle}} at {{organizationName}} — extra {{missing}}'
    const vars = { jobTitle: 'Engineer', organizationName: 'Reqcore' }

    expect(renderTemplatePreview(template, vars)).toBe(renderTemplate(template, vars))
  })

  it('renders every bundled SYSTEM_TEMPLATES entry without throwing', () => {
    const vars = {
      candidateName: 'Ada Lovelace',
      candidateFirstName: 'Ada',
      candidateLastName: 'Lovelace',
      candidateEmail: 'ada@example.com',
      jobTitle: 'Engineer',
      interviewTitle: 'Onsite',
      interviewDate: '2026-07-20',
      interviewTime: '10:00',
      interviewDuration: '60',
      interviewType: 'Video call',
      interviewLocation: 'Zoom',
      interviewers: 'Grace Hopper',
      organizationName: 'Reqcore',
    }
    for (const t of SYSTEM_TEMPLATES) {
      expect(() => renderTemplatePreview(t.subject, vars)).not.toThrow()
      expect(() => renderTemplatePreview(t.body, vars)).not.toThrow()
    }
  })
})

/**
 * Screening variables/defaults must never leak into the interview template
 * picker (SYSTEM_TEMPLATES) — that list is scanned by the interview UI and
 * adding screening entries there would surface unresolved interview-only tags.
 */
describe('shared/screening-template: isolation from SYSTEM_TEMPLATES', () => {
  it('does not add screening entries to SYSTEM_TEMPLATES', () => {
    const systemTemplateIds = SYSTEM_TEMPLATES.map(t => t.id)
    expect(systemTemplateIds.some(id => id.toLowerCase().includes('screening'))).toBe(false)
  })

  it('DEFAULT_SCREENING_TEMPLATE only references declared screening variables', () => {
    const usedTags = new Set<string>()
    for (const text of [DEFAULT_SCREENING_TEMPLATE.subject, DEFAULT_SCREENING_TEMPLATE.body]) {
      for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
        usedTags.add(match[1]!)
      }
    }
    for (const tag of usedTags) {
      expect(SCREENING_TEMPLATE_VARIABLES as readonly string[]).toContain(tag)
    }
  })

  it('DEFAULT_SCREENING_TEMPLATE renders cleanly with sample data (no leftover tags)', () => {
    const vars: Record<string, string> = {
      candidateName: 'Ada Lovelace',
      candidateFirstName: 'Ada',
      candidateLastName: 'Lovelace',
      candidateEmail: 'ada@example.com',
      jobTitle: 'Engineer',
      organizationName: 'Reqcore',
      senderName: 'Grace Hopper',
    }
    const renderedSubject = renderTemplate(DEFAULT_SCREENING_TEMPLATE.subject, vars)
    const renderedBody = renderTemplate(DEFAULT_SCREENING_TEMPLATE.body, vars)
    expect(renderedSubject).not.toMatch(/\{\{\w+\}\}/)
    expect(renderedBody).not.toMatch(/\{\{\w+\}\}/)
  })

  it('does not use interview-only date/time variables', () => {
    const interviewOnly = ['interviewDate', 'interviewTime', 'interviewDuration', 'interviewType', 'interviewLocation', 'interviewers', 'interviewTitle']
    const combined = `${DEFAULT_SCREENING_TEMPLATE.subject}\n${DEFAULT_SCREENING_TEMPLATE.body}`
    for (const tag of interviewOnly) {
      expect(combined).not.toContain(`{{${tag}}}`)
    }
  })
})

/**
 * Regression: server/utils/email.ts's interview-typed renderTemplate must keep
 * producing byte-identical output (including the pre-existing 'To be
 * confirmed' fallback defaults) after being rewired to delegate to the shared
 * generic renderer.
 */
describe('server/utils/email: renderTemplate (InterviewEmailData) regression', () => {
  const baseData: InterviewEmailData = {
    candidateName: 'Ada Lovelace',
    candidateFirstName: 'Ada',
    candidateLastName: 'Lovelace',
    candidateEmail: 'ada@example.com',
    jobTitle: 'Senior Engineer',
    interviewTitle: 'Onsite Interview',
    interviewDate: '2026-07-20',
    interviewTime: '10:00',
    interviewDuration: 60,
    interviewType: 'Video call',
    interviewLocation: 'https://zoom.example.com/1',
    interviewers: ['Grace Hopper', 'Alan Turing'],
    organizationName: 'Reqcore',
  }

  it('renders all interview fields, including interviewers joined with commas', () => {
    const template = '{{candidateName}} / {{jobTitle}} / {{interviewDate}} {{interviewTime}} ({{interviewDuration}}min) / {{interviewType}} @ {{interviewLocation}} with {{interviewers}} — {{organizationName}}'
    expect(renderInterviewTemplate(template, baseData)).toBe(
      'Ada Lovelace / Senior Engineer / 2026-07-20 10:00 (60min) / Video call @ https://zoom.example.com/1 with Grace Hopper, Alan Turing — Reqcore',
    )
  })

  it('falls back to "To be confirmed" when interviewLocation is null', () => {
    const data: InterviewEmailData = { ...baseData, interviewLocation: null }
    expect(renderInterviewTemplate('Location: {{interviewLocation}}', data)).toBe('Location: To be confirmed')
  })

  it('falls back to "To be confirmed" when interviewers is null', () => {
    const data: InterviewEmailData = { ...baseData, interviewers: null }
    expect(renderInterviewTemplate('Interviewers: {{interviewers}}', data)).toBe('Interviewers: To be confirmed')
  })

  it('leaves unknown tags untouched for interview data too', () => {
    expect(renderInterviewTemplate('{{candidateName}} {{notAField}}', baseData)).toBe('Ada Lovelace {{notAField}}')
  })
})
