import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TestDetail } from './types'

type TestSource = {
  filePath: string
  format: 'single' | 'test-wrapper' | 'array' | 'tests-array'
  index?: number
}

const testsDir = process.env.TESTS_DIR ?? join(import.meta.dir, '..', 'data', 'tests')

let testSources = new Map<string, TestSource>()
let testsCache: TestDetail[] = []

const ensureTestsDir = () => {
  mkdirSync(testsDir, { recursive: true })
}

const normalizeTest = (raw: TestDetail): TestDetail => ({
  ...raw,
  published: raw.published ?? false,
  sections: raw.sections ?? [],
})

export const loadTestsFromDisk = () => {
  ensureTestsDir()

  const files = readdirSync(testsDir).filter((file) => file.endsWith('.json')).sort()
  const tests: TestDetail[] = []
  testSources = new Map()

  for (const file of files) {
    const filePath = join(testsDir, file)
    const raw = JSON.parse(readFileSync(filePath, 'utf8'))

    if (Array.isArray(raw)) {
      raw.forEach((item, index) => {
        const test = normalizeTest(item as TestDetail)
        tests.push(test)
        testSources.set(test.id, { filePath, format: 'array', index })
      })
      continue
    }

    if (raw && Array.isArray(raw.tests)) {
      raw.tests.forEach((item: TestDetail, index: number) => {
        const test = normalizeTest(item)
        tests.push(test)
        testSources.set(test.id, { filePath, format: 'tests-array', index })
      })
      continue
    }

    if (raw && raw.test) {
      const test = normalizeTest(raw.test as TestDetail)
      tests.push(test)
      testSources.set(test.id, { filePath, format: 'test-wrapper' })
      continue
    }

    const test = normalizeTest(raw as TestDetail)
    tests.push(test)
    testSources.set(test.id, { filePath, format: 'single' })
  }

  testsCache = tests
  return testsCache
}

export const getTestsCache = () => testsCache

export const updateTestPublished = (testId: string, published: boolean) => {
  const source = testSources.get(testId)
  if (!source) return null

  const raw = JSON.parse(readFileSync(source.filePath, 'utf8'))

  if (source.format === 'array' && Array.isArray(raw)) {
    raw[source.index ?? 0].published = published
    writeFileSync(source.filePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return loadTestsFromDisk()
  }

  if (source.format === 'tests-array' && raw && Array.isArray(raw.tests)) {
    raw.tests[source.index ?? 0].published = published
    writeFileSync(source.filePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return loadTestsFromDisk()
  }

  if (source.format === 'test-wrapper' && raw && raw.test) {
    raw.test.published = published
    writeFileSync(source.filePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return loadTestsFromDisk()
  }

  if (source.format === 'single') {
    raw.published = published
    writeFileSync(source.filePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
    return loadTestsFromDisk()
  }

  return null
}

export const getTestsDir = () => testsDir
