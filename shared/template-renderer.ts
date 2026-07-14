/**
 * Generic {{variable}} template renderer shared by both the server (interview
 * invitation emails) and the app (template preview UI). Keeping a single
 * implementation avoids subtly diverging regexes/behavior between the two
 * call sites.
 *
 * Replaces every `{{key}}` occurrence with `vars[key]` when known. Unknown
 * tags (no matching key in `vars`) are left untouched in the output so that
 * partially-filled previews and malformed tags don't silently disappear.
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in vars ? vars[key]! : match
  })
}
