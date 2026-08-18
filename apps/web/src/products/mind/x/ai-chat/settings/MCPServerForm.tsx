// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * MCP 服务器表单组件
 *
 * 数据走后端 trpc.mcp.*（按 userId 入库，PAT 加密）。
 * 支持两种模式：
 *  - 普通 MCP server：填 name + url + headers
 *  - 预设模式（如 Figma）：只填一个 token，url/工具由后端预设决定
 */

import React, { useState, useEffect, useMemo } from 'react'
import type { McpServerItem, McpPresetItem } from '../../lib/api-types'
import { useTranslation } from '@zoeymind/i18n'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@zoeymind/ui'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@zoeymind/ui'
import { Input } from '@zoeymind/ui'
import { Button } from '@zoeymind/ui'
import { Loader2, Globe } from 'lucide-react'
import { trpc } from '../../lib/trpc'
import { mcpManager } from '../../mcp-client'
import { useToast } from '@/shared/app-shared'

interface MCPServerFormProps {
  open: boolean
  onClose: () => void
  /** 编辑时传入服务器 id */
  serverId: string | null
  /** 预设标识（如 'figma'），从预设添加时传入 */
  preset?: string | null
}

type PresetInfo = {
  id: string
  name: string
  defaultUrl: string
  tokenHeader: string
  tokenHint: string | null
}

export const MCPServerForm: React.FC<MCPServerFormProps> = ({
  open,
  onClose,
  serverId,
  preset = null
}) => {
  const { t } = useTranslation()
  const { toast } = useToast()
  const utils = trpc.useUtils()
  const isEdit = !!serverId

  // 预设列表（拿到当前 preset 的元信息）
  const { data: presets } = trpc.mcp.listPresets.useQuery<McpPresetItem[]>(undefined, { enabled: open })
  // 编辑时取现有服务器
  const { data: servers } = trpc.mcp.list.useQuery<McpServerItem[]>(undefined, { enabled: open && isEdit })
  const existing = useMemo(() => servers?.find(s => s.id === serverId) ?? null, [servers, serverId])

  // 当前生效的预设：新增预设模式用 prop.preset；编辑时用记录的 preset
  const activePreset: PresetInfo | null = useMemo(() => {
    const pid = isEdit ? existing?.preset : preset
    if (!pid || !presets) return null
    return presets.find(p => p.id === pid) ?? null
  }, [isEdit, existing, preset, presets])
  const isPresetMode = !!activePreset

  const [isTesting, setIsTesting] = useState(false)
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [token, setToken] = useState('')

  const serverFormSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('mindmap.aiChat.settings.form.errors.nameRequired')),
        url: isPresetMode
          ? z.string()
          : z.string().url(t('mindmap.aiChat.settings.form.errors.invalidUrl'))
      }),
    [t, isPresetMode]
  )

  const form = useForm<{ name: string; url: string }>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: { name: '', url: '' }
  })

  // 表单初始化：编辑回填 / 预设填默认名
  useEffect(() => {
    if (!open) return
    if (isEdit && existing) {
      form.reset({ name: existing.name, url: existing.url })
      setHeaders(existing.headers ?? {})
      setToken('')
    } else if (activePreset) {
      form.reset({ name: activePreset.name, url: activePreset.defaultUrl })
      setHeaders({})
      setToken('')
    } else {
      form.reset({ name: '', url: '' })
      setHeaders({})
      setToken('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, existing, activePreset])

  const createMutation = trpc.mcp.create.useMutation()
  const updateMutation = trpc.mcp.update.useMutation()
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const handleTestConnection = async () => {
    // 预设模式（如 Figma 原生工具）无远程连接可测
    if (isPresetMode) {
      toast({ description: t('mindmap.aiChat.settings.form.presetNoTest') })
      return
    }
    const values = form.getValues()
    setIsTesting(true)
    try {
      const result = await mcpManager.testConnection({
        name: values.name,
        url: values.url,
        headers
      })
      if (result.success) {
        toast({
          title: t('mindmap.aiChat.settings.toast.connectSuccess'),
          description: t('mindmap.aiChat.settings.toast.connectSuccessDesc', {
            count: result.toolCount ?? 0
          })
        })
      } else {
        toast({
          title: t('mindmap.aiChat.settings.toast.connectFailed'),
          description: result.error || t('mindmap.aiChat.settings.unknownError'),
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: t('mindmap.aiChat.settings.toast.connectFailed'),
        description:
          error instanceof Error ? error.message : t('mindmap.aiChat.settings.unknownError'),
        variant: 'destructive'
      })
    } finally {
      setIsTesting(false)
    }
  }

  const onSubmit = async (values: { name: string; url: string }) => {
    try {
      if (isEdit && serverId) {
        await updateMutation.mutateAsync({
          id: serverId,
          name: values.name,
          url: isPresetMode ? undefined : values.url,
          headers: isPresetMode ? undefined : headers,
          // 预设模式：token 非空才更新；普通模式不动 token
          secretToken: isPresetMode && token ? token : undefined
        })
        toast({
          description: t('mindmap.aiChat.settings.toast.serverUpdatedDesc', { name: values.name })
        })
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          preset: activePreset?.id ?? null,
          url: activePreset?.defaultUrl ?? values.url,
          secretToken: isPresetMode ? token : undefined,
          headers: isPresetMode ? undefined : headers
        })
        toast({
          description: t('mindmap.aiChat.settings.toast.serverAddedDesc', { name: values.name })
        })
      }
      await utils.mcp.list.invalidate()
      onClose()
    } catch (error) {
      toast({
        title: t('mindmap.aiChat.settings.toast.operationFailed'),
        description:
          error instanceof Error ? error.message : t('mindmap.aiChat.settings.unknownError'),
        variant: 'destructive'
      })
    }
  }

  const addHeader = () => setHeaders({ ...headers, '': '' })
  const updateHeader = (index: number, key: string, value: string) => {
    const entries = Object.entries(headers)
    entries[index] = [key, value]
    setHeaders(Object.fromEntries(entries))
  }
  const removeHeader = (key: string) => {
    const next = { ...headers }
    delete next[key]
    setHeaders(next)
  }

  const title = isEdit
    ? t('mindmap.aiChat.settings.form.editTitle')
    : activePreset
      ? t('mindmap.aiChat.settings.form.addPresetTitle', { name: activePreset.name })
      : t('mindmap.aiChat.settings.form.addTitle')

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('mindmap.aiChat.settings.form.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('mindmap.aiChat.settings.form.namePlaceholder')}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('mindmap.aiChat.settings.form.nameDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isPresetMode ? (
              <FormItem>
                <FormLabel>{t('mindmap.aiChat.settings.form.tokenLabel')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder={
                      isEdit
                        ? t('mindmap.aiChat.settings.form.tokenEditPlaceholder')
                        : t('mindmap.aiChat.settings.form.tokenPlaceholder')
                    }
                    className="font-mono text-sm"
                  />
                </FormControl>
                {activePreset?.tokenHint && (
                  <FormDescription>{activePreset.tokenHint}</FormDescription>
                )}
              </FormItem>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('mindmap.aiChat.settings.form.urlLabel')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://mcp.context7.com/mcp" />
                      </FormControl>
                      <FormDescription>
                        {t('mindmap.aiChat.settings.form.urlDescription')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>{t('mindmap.aiChat.settings.form.headersLabel')}</FormLabel>
                  <FormDescription className="mb-2">
                    {t('mindmap.aiChat.settings.form.headersDescription')}
                  </FormDescription>
                  <div className="space-y-2">
                    {Object.entries(headers).map(([key, value], index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={t('mindmap.aiChat.settings.form.headerNamePlaceholder')}
                          value={key}
                          onChange={e => updateHeader(index, e.target.value, value)}
                          className="flex-1 font-mono text-sm"
                        />
                        <Input
                          placeholder={t('mindmap.aiChat.settings.form.headerValuePlaceholder')}
                          value={value}
                          onChange={e => updateHeader(index, key, e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHeader(key)}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addHeader}
                      className="w-full"
                    >
                      {t('mindmap.aiChat.settings.form.addHeader')}
                    </Button>
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              {!isPresetMode && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Globe className="size-4 mr-2" />
                  )}
                  {t('mindmap.aiChat.settings.form.testConnection')}
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                {isEdit ? t('common.save') : t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}