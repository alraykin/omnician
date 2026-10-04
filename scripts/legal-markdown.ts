import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  classifyLegalHref,
  hasHiddenLegalNotes,
  headingIds,
  headingSlug,
  parseInline,
  parseLegalMarkdown,
} from '../src/lib/legal-markdown.ts'

assert.equal(headingSlug('8. Children and teens'), '8-children-and-teens')
assert.equal(
  headingSlug('10. Your choices and how to delete your data'),
  '10-your-choices-and-how-to-delete-your-data',
)
assert.equal(
  headingSlug('5. Subscriptions, free trials, and payments (when available)'),
  '5-subscriptions-free-trials-and-payments-when-available',
)

assert.equal(classifyLegalHref('/terms'), 'internal')
assert.equal(classifyLegalHref('/privacy#8-children-and-teens'), 'internal')
assert.equal(classifyLegalHref('#10-your-choices-and-how-to-delete-your-data'), 'hash')
assert.equal(classifyLegalHref('mailto:support@omnician.app'), 'mailto')
assert.equal(classifyLegalHref('https://policies.google.com/privacy'), 'external')

function flattenInline(nodes: ReturnType<typeof parseInline>): ReturnType<typeof parseInline> {
  return nodes.flatMap((node) => {
    if (node.type === 'text') return [node]
    if (node.type === 'strong') return flattenInline(node.children)
    return [node, ...flattenInline(node.children)]
  })
}

const emailNodes = flattenInline(parseInline('Email **support@omnician.app**'))
const emailLink = emailNodes.find((node) => node.type === 'link')
assert.ok(emailLink && emailLink.type === 'link')
assert.equal(emailLink.href, 'mailto:support@omnician.app')

const tableMd = `| Sample | License |
| --- | --- |
| Click Wood | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |`
const table = parseLegalMarkdown(tableMd)
assert.equal(table[0]?.type, 'table')
if (table[0]?.type === 'table') {
  assert.equal(table[0].headers.length, 2)
  assert.equal(table[0].rows.length, 1)
  const license = table[0].rows[0]?.[1]?.find((node) => node.type === 'link')
  assert.ok(license && license.type === 'link')
  assert.equal(classifyLegalHref(license.href), 'external')
}

const privacyPath = join(dirname(fileURLToPath(import.meta.url)), '../src/legal/privacy.md')
const privacy = readFileSync(privacyPath, 'utf8')
assert.equal(hasHiddenLegalNotes(privacy), false)
assert.equal(privacy.includes('Placeholder'), false)
assert.match(privacy, /support@omnician\.app/)
assert.match(privacy, /Raykin Music LLC/)

const blocks = parseLegalMarkdown(privacy)
const ids = headingIds(blocks)
assert.ok(ids.includes('privacy-policy'))
assert.ok(ids.includes('8-children-and-teens'))
assert.ok(ids.includes('10-your-choices-and-how-to-delete-your-data'))
assert.ok(ids.includes('the-short-version'))

const termsLink = blocks
  .flatMap((block) => {
    if (block.type === 'ol') return block.items.flat()
    if (block.type === 'ul') return block.items.flat()
    if (block.type === 'p') return block.lines.flat()
    return []
  })
  .find((node) => node.type === 'link' && node.href === '/terms')
assert.ok(termsLink)

console.log('legal-markdown ok')
