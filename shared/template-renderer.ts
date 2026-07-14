/**
 * Generic {{variable}} template renderer shared by both the server (interview
 * invitation emails) and the app (template preview UI). Keeping a single
 * implementation avoids subtly diverging regexes/behavior between the two
 * call sites.
 *
 * Canonical placeholder pattern: `{{tagName}}` with no whitespace inside the
 * braces. This is exported so validators (e.g. screening email template
 * validation) can check tags against the *exact* pattern the renderer
 * substitutes — anything that doesn't match (e.g. `{{ jobTitle }}` with inner
 * whitespace) is left untouched by `renderTemplate` and would otherwise leak
 * into the rendered output unresolved.
 */
export const TEMPLATE_TAG_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Matches any double-brace block, including malformed ones (e.g. containing
 * whitespace or punctuation) that `TEMPLATE_TAG_PATTERN` won't substitute.
 * Used by validators to flag placeholders that look like tags but won't
 * actually be replaced at render time.
 */
export const TEMPLATE_TAG_LIKE_PATTERN = /\{\{[^{}]*\}\}/g

/** Extracts the well-formed `{{tag}}` placeholder names that `renderTemplate` will substitute. */
export function extractTemplateTags(template: string): string[] {
  return [...template.matchAll(TEMPLATE_TAG_PATTERN)].map(match => match[1]!)
}

/**
 * Replaces every `{{key}}` occurrence with `vars[key]` when known. Unknown
 * tags (no matching key in `vars`) are left untouched in the output so that
 * partially-filled previews and malformed tags don't silently disappear.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(TEMPLATE_TAG_PATTERN, (match, key: string) => {
    return key in vars ? vars[key]! : match
  })
}
