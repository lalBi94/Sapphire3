import test from 'node:test'
import assert from 'node:assert/strict'
import { writeWorkspaceFile } from '../../src/utils/workspaceFile.js'

test('writeWorkspaceFile : succès simple', async () => {
  // Mock filesystem minimal
  const mockFs = {
    writeFile: async () => {},
    getStats: async () => ({ isFile: true, size: 0 }),
    rename: async () => {},
    readFile: async () => '',
    deleteFile: async () => {}
  }
  const mockClient = {
    extension: 'sp3',
    filesystem: mockFs,
    async writeFile(path, content) { await mockFs.writeFile(path, content) },
    async getStats(path) { return mockFs.getStats(path) }
  }
  const result = await writeWorkspaceFile('/tmp/test.sp3', 'test data', mockClient)
  assert.equal(result, '/tmp/test.sp3')
})

test('writeWorkspaceFile : lève DESKTOP_REQUIRED sans client', async () => {
  await assert.rejects(
    writeWorkspaceFile('/tmp/test.sp3', 'data'),
    /DESKTOP_REQUIRED/
  )
})

test('writeWorkspaceFile : format invalide refusé', async () => {
  await assert.rejects(
    writeWorkspaceFile('/tmp/test.xyz', 'data'),
    /FILE_EXTENSION_INVALID/
  )
})

test('writeWorkspaceFile : taille trop grande refusée', async () => {
  const huge = 'x'.repeat(21 * 1024 * 1024 + 1)
  await assert.rejects(
    writeWorkspaceFile('/tmp/test.sp3', huge),
    /FILE_TOO_LARGE/
  )
})