import { beforeEach, describe, expect, it, vi } from 'vitest'

const fs = vi.hoisted(() => ({
  exists: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn()
}))
const db = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => fs)
vi.mock('@tauri-apps/api/path', () => ({
  dirname: vi.fn(async (path: string) => path.replace(/[\\/][^\\/]+$/, '')),
  join: vi.fn(async (dir: string, name: string) => `${dir}/${name}`)
}))
vi.mock('./db', () => db)

import { moveProjectToFolder, renameProjectFile } from './projects-repo'

const rawProject = {
  id: 'project-1',
  path: '/vault/Old name.zmind',
  name: 'Old name',
  folder_id: null,
  is_starred: 0,
  is_archived: 0,
  tags_json: '[]',
  node_count: 3,
  size: 100,
  mtime: 1,
  created_at: 1,
  updated_at: 1,
  last_opened_at: null
}

describe('renameProjectFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.select.mockResolvedValue([rawProject])
    fs.exists.mockImplementation(async (path: string) => path === rawProject.path)
    fs.rename.mockResolvedValue(undefined)
    db.execute.mockResolvedValue(undefined)
  })

  it('renames the backing .zmind file and synchronizes its indexed path and name', async () => {
    const result = await renameProjectFile('project-1', 'New/name')

    expect(fs.rename).toHaveBeenCalledWith('/vault/Old name.zmind', '/vault/New_name.zmind')
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('SET path = $1, name = $2'),
      ['/vault/New_name.zmind', 'New_name', expect.any(Number), 'project-1']
    )
    expect(result).toEqual({ path: '/vault/New_name.zmind', name: 'New_name' })
  })

  it('refuses to overwrite an existing project file', async () => {
    fs.exists.mockResolvedValue(true)

    await expect(renameProjectFile('project-1', 'Taken')).rejects.toThrow('已存在')
    expect(fs.rename).not.toHaveBeenCalled()
    expect(db.execute).not.toHaveBeenCalled()
  })
})

describe('moveProjectToFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.select.mockResolvedValue([rawProject])
    fs.exists.mockResolvedValue(true)
    db.execute.mockResolvedValue(undefined)
  })

  it('changes only the virtual folder relation and leaves the file path untouched', async () => {
    await moveProjectToFolder('project-1', 'folder-2')

    expect(fs.rename).not.toHaveBeenCalled()
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('SET folder_id = $1'),
      ['folder-2', expect.any(Number), 'project-1']
    )
  })
})
