/**
 * 桌面端 prompts 用 react-query 包一层 sqlite 仓库,
 * 让 PromptManagerModal / PromptList / PromptEditor 保留 useQuery / useMutation
 * 的写法, 只是数据源换成 storage/prompt-repo.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPrompt,
  deletePrompt,
  listPrompts,
  togglePromptEnable,
  updatePrompt,
  type PromptRecord
} from '../storage/prompt-repo'

const PROMPTS_KEY = ['zm', 'prompts', 'list'] as const

export function usePromptsQuery() {
  return useQuery<PromptRecord[]>({
    queryKey: PROMPTS_KEY,
    queryFn: listPrompts
  })
}

export function useCreatePrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { title: string; content: string }) => createPrompt(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMPTS_KEY })
  })
}

export function useUpdatePrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; title: string; content: string }) => updatePrompt(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMPTS_KEY })
  })
}

export function useTogglePromptEnable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; isEnabled: boolean }) => togglePromptEnable(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMPTS_KEY })
  })
}

export function useDeletePrompt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePrompt(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROMPTS_KEY })
  })
}
