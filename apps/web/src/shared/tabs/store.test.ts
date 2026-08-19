import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/app-shared/loading', () => ({
  useLoadingStore: { getState: () => ({ showLoading: vi.fn() }) }
}))
vi.mock('./loading', () => ({
  useTabLoading: { getState: () => ({ setLoading: vi.fn(), clear: vi.fn() }) }
}))

import { useTabs } from './store'

describe('project tab rename', () => {
  beforeEach(() => {
    useTabs.setState({
      activeId: 'draft-tab',
      tabs: [
        {
          id: 'draft-tab',
          kind: 'file',
          title: 'Old name',
          projectId: 'project-1'
        },
        {
          id: 'project-2',
          kind: 'file',
          title: 'Other project',
          projectId: 'project-2'
        }
      ]
    })
  })

  it('renames a persisted file tab by its backing project id', () => {
    useTabs.getState().renameProjectTabs('project-1', 'New name')

    expect(useTabs.getState().tabs.map(tab => tab.title)).toEqual(['New name', 'Other project'])
  })
})
