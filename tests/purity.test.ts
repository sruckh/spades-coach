import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The pure domain layer must not depend on React or boardgame.io. Verified by
// reading the source: the UI asks the engine for legal moves; it never re-derives
// rules, and these modules never reach into a framework.
const PURE_FILES = [
  'src/types.ts',
  'src/game/deck.ts',
  'src/game/scoring.ts',
  'src/analysis/handEval.ts',
]

describe('engine purity', () => {
  for (const rel of PURE_FILES) {
    it(`${rel} imports no React or boardgame.io`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8')
      expect(src).not.toMatch(/from\s+['"]react['"]/)
      expect(src).not.toMatch(/from\s+['"]react-dom/)
      expect(src).not.toMatch(/from\s+['"]boardgame\.io/)
      expect(src).not.toMatch(/require\(\s*['"](?:react|boardgame\.io)/)
    })
  }
})
