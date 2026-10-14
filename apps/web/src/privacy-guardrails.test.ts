// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LEGAL_DETAILS } from './copy/names'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter((file) => file && !file.startsWith('.github/agents/'))

const tracker =
  /(?:@(?:vercel\/analytics|next\/third-parties)|google-analytics|googletagmanager|google\s*analytics|gtag\s*\(|analytics\.js|segment(?:io)?[/.]|@segment\/|mixpanel|hotjar|posthog|plausible|matomo|clarity\.ms|cdn\.amplitude\.com|@amplitude\/|amplitude-js)/i
const thisFile = 'apps/web/src/privacy-guardrails.test.ts'

describe('privacy guardrails', () => {
  it('defines each shared legal placeholder only once, in LEGAL_DETAILS', () => {
    const copyFile = 'apps/web/src/copy/names.ts'
    const copy = readFileSync(`${root}/${copyFile}`, 'utf8')
    const constant = copy.slice(
      copy.indexOf('export const LEGAL_DETAILS'),
      copy.indexOf('export const NAMES'),
    )
    for (const placeholder of Object.values(LEGAL_DETAILS)) {
      if (!placeholder.startsWith('[')) continue
      expect(constant.split(placeholder)).toHaveLength(2)
      for (const file of files) {
        const text = readFileSync(`${root}/${file}`, 'utf8')
        expect(text.split(placeholder).length - 1, file).toBe(
          file === copyFile ? 1 : 0,
        )
      }
    }
  })

  it.each([
    "import '@vercel/analytics/react'",
    "require('@segment/analytics-next')",
    "import('posthog-js')",
    '<script src="https://www.googletagmanager.com/gtag/js"></script>',
    'gtag("config", id)',
    '<script src="https://cdn.mxpnl.com/libs/mixpanel.js"></script>',
    '<script src="https://static.hotjar.com/c/hotjar.js"></script>',
  ])('detects tracking packages and scripts: %s', (source) => {
    expect(tracker.test(source)).toBe(true)
  })

  it('forbids known tracking packages, imports and loaded scripts', () => {
    const sources = files.filter(
      (file) =>
        file !== thisFile &&
        /^(apps|packages)\//.test(file) &&
        (/\.(?:[cm]?[jt]sx?|html)$/.test(file) ||
          file.endsWith('/package.json')) &&
        !/(?:^|\/)(?:dist|generated|build|coverage|node_modules)\//.test(file),
    )
    for (const file of sources) {
      expect(readFileSync(`${root}/${file}`, 'utf8')).not.toMatch(tracker)
    }
    expect(
      readFileSync(`${root}/apps/web/src/wallet/config.ts`, 'utf8'),
    ).toMatch(/analytics:\s*false/)
  })
})
