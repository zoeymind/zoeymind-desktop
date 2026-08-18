import React, { FC, useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { ArrowLeftRight, RefreshCw, X, Search, FileQuestion } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@zoeymind/ui'
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@zoeymind/ui'
import { ScrollArea } from '@zoeymind/ui'
import type { default as MindMap, MindMapNode } from 'simple-mind-map'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'

interface SearchEventData {
  current: number
  total: number
}

type SearchEventCallback = (data: SearchEventData) => void

interface SearchResult {
  text: string
  path: string[]
  node: MindMapNode
}

interface TopSearchProps {
  isActive: boolean
  onClose: () => void
  initialText?: string
}

interface MindMapSearchPlugin {
  matchNodeList: MindMapNode[]
  search: (keyword: string, callback?: () => void) => void
  endSearch: () => void
  jump: (index: number, callback?: () => void) => void
  replace: (text: string) => void
  replaceAll: (text: string) => void
}

const getSearchPlugin = (map: MindMap | null): MindMapSearchPlugin | null => {
  const search = map?.search as Partial<MindMapSearchPlugin> | undefined
  if (
    search &&
    typeof search.search === 'function' &&
    typeof search.endSearch === 'function' &&
    typeof search.jump === 'function' &&
    typeof search.replace === 'function' &&
    typeof search.replaceAll === 'function' &&
    Array.isArray(search.matchNodeList)
  ) {
    return search as MindMapSearchPlugin
  }
  return null
}

export const TopSearch: FC<TopSearchProps> = ({ isActive, onClose, initialText = '' }) => {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()
  const [searchText, setSearchText] = useState<string>(initialText || '')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(!!initialText)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 当组件激活时自动聚焦搜索框并设置初始文本
  useEffect(() => {
    if (!isActive) {
      // 组件关闭时清理状态
      setSearchText('')
      setHasSearched(false)
      setSearchResults([])
      setCurrentIndex(0)
      if (mindMap?.search) {
        mindMap.search.endSearch()
      }
      return
    }
    if (!searchInputRef.current) return

    // 设置初始文本
    if (initialText) {
      setSearchText(initialText)
      setHasSearched(true)
    }

    // 延迟聚焦，确保动画完成
    const timer = setTimeout(() => {
      searchInputRef.current?.focus()
      // 如果有初始文本，选中所有文本
      if (initialText) {
        searchInputRef.current?.select()
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [isActive, initialText, mindMap])

  // 获取节点路径
  const getNodePath = (node: MindMapNode): string[] => {
    const path: string[] = []
    let current: MindMapNode | null | undefined = node

    while (current) {
      const text = current.nodeData?.data?.text || current.data?.text
      if (text) path.unshift(text)
      current = current.parent
    }
    return path
  }

  // 转义正则表达式特殊字符
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // 高亮搜索文本
  const highlightText = (text: string, searchText: string) => {
    if (!searchText) return text

    try {
      // 转义搜索文本中的正则表达式特殊字符
      const escapedSearchText = escapeRegExp(searchText)
      const parts = text.split(new RegExp(`(${escapedSearchText})`, 'gi'))
      return (
        <React.Fragment>
          {parts.map((part, i) =>
            part.toLowerCase() === searchText.toLowerCase() ? (
              <span key={i} className="rounded-sm bg-warning/30 px-0.5 text-foreground">
                {part}
              </span>
            ) : (
              part
            )
          )}
        </React.Fragment>
      )
    } catch {
      // 如果出现任何错误，返回原始文本
      return text
    }
  }

  // 使用 simple-mind-map 插件搜索
  const getAllMatchedNodes = useCallback(() => {
    const searchPlugin = getSearchPlugin(mindMap)
    if (!searchPlugin || !searchText || !mindMap) return []

    mindMap.opt.isOnlySearchCurrentRenderNodes = false

    searchPlugin.search(searchText)
    const matchList = searchPlugin.matchNodeList || []

    return matchList
      .map(node => {
        const textValue =
          typeof node.getData === 'function'
            ? (node.getData('text') as string | undefined)
            : node.data?.text
        return {
          text: textValue || '',
          path: getNodePath(node),
          node
        }
      })
      .filter((result): result is SearchResult => Boolean(result.text))
  }, [mindMap, searchText])

  // 处理搜索文本变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value)
    if (e.target.value) {
      setHasSearched(true)
    } else {
      setHasSearched(false)
    }
  }

  // 使用 useEffect 监听搜索文本变化
  useEffect(() => {
    if (searchText) {
      // 使用我们自己的搜索逻辑来获取和显示结果
      // 这样可以避免与 simple-mind-map 内部搜索状态的冲突
      const results = getAllMatchedNodes()
      setSearchResults(results)
      setCurrentIndex(0)
    } else {
      // 清空搜索
      if (mindMap?.search) {
        mindMap.search.endSearch()
      }
      setCurrentIndex(0)
      setSearchResults([])
    }
  }, [searchText, mindMap, getAllMatchedNodes])

  // 处理清除
  const handleClear = () => {
    setSearchText('')
    setHasSearched(false)
    const searchPlugin = getSearchPlugin(mindMap)
    if (searchPlugin) {
      searchPlugin.endSearch()
    }
    setCurrentIndex(0)
  }

  // 跳转到指定结果
  const jumpToResult = (index: number) => {
    const searchPlugin = getSearchPlugin(mindMap)
    if (searchPlugin) {
      searchPlugin.jump(index, () => setCurrentIndex(index))
    }
  }

  useEffect(() => {
    if (!mindMap) return

    const handleSearchInfoChange: SearchEventCallback = data => {
      // 只有在有效搜索时才更新索引
      if (data.total > 0 && data.current >= 0) {
        setCurrentIndex(data.current)
      }
    }

    mindMap.on('search_info_change', handleSearchInfoChange)

    return () => {
      mindMap.off('search_info_change', handleSearchInfoChange)
    }
  }, [mindMap])

  // 处理替换当前
  const handleReplace = () => {
    const searchPlugin = getSearchPlugin(mindMap)
    if (!searchText || !replaceText || !searchPlugin) return

    searchPlugin.search(searchText, () => {
      searchPlugin.replace(replaceText)
      searchPlugin.endSearch()
      const results = getAllMatchedNodes()
      setSearchResults(results)
    })
  }

  // 处理替换所有
  const handleReplaceAll = () => {
    const searchPlugin = getSearchPlugin(mindMap)
    if (!searchText || !replaceText || !searchPlugin) return

    searchPlugin.search(searchText, () => {
      searchPlugin.replaceAll(replaceText)
      searchPlugin.endSearch()
      const results = getAllMatchedNodes()
      setSearchResults(results)
      setReplaceText('')
    })
  }

  // 切换替换面板
  const toggleReplacePanel = () => {
    setShowReplace(!showReplace)
  }

  // 自定义替换按钮作为后缀图标
  // ReplaceSuffixIcon moved to module scope (above component)
  // 渲染搜索结果区域
  const renderSearchResultsArea = () => {
    // 未搜索状态
    if (!hasSearched) {
      return (
        <motion.div
          className="mt-6 flex flex-col items-center justify-center text-center py-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Search className="size-10 text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">{t('mindmap.topbar.search.hint')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('mindmap.topbar.search.subHint')}</p>
        </motion.div>
      )
    }

    // 有搜索词但无结果
    if (searchText && searchResults.length === 0) {
      return (
        <motion.div
          className="mt-6 flex flex-col items-center justify-center text-center py-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <FileQuestion className="size-10 text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">{t('mindmap.topbar.search.noResults')}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('mindmap.topbar.search.tryOther')}
          </p>
        </motion.div>
      )
    }

    // 有搜索结果
    if (searchResults.length > 0) {
      return (
        <motion.div
          className="mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-sm font-medium mb-2">
            {t('mindmap.topbar.search.results', { value: searchResults.length })}
          </div>
          <ScrollArea className="h-[240px]">
            <motion.div className="space-y-1">
              {searchResults.map((result, index) => (
                <motion.div
                  key={index}
                  className={`p-2 rounded-md cursor-pointer text-sm hover:bg-muted ${
                    index === currentIndex ? 'bg-muted' : ''
                  }`}
                  onClick={() => jumpToResult(index)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="font-medium">{highlightText(result.text, searchText)}</div>
                  {result.path.length > 1 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('mindmap.topbar.search.path', { value: result.path.join(' > ') })}
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </ScrollArea>
        </motion.div>
      )
    }

    return null
  }

  if (!isActive) return null

  return (
    <div>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{t('common.search')}</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="size-7">
          <X className="size-4" />
        </Button>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {/* 搜索输入框 */}
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchInputRef}
              value={searchText}
              onChange={handleSearchChange}
              placeholder={t('mindmap.topbar.search.placeholder')}
            />
            <InputGroupAddon align="inline-end">
              {searchText && (
                <InputGroupButton size="icon-xs" aria-label="clear" onClick={handleClear}>
                  <X />
                </InputGroupButton>
              )}
              <InputGroupButton
                size="icon-xs"
                aria-label={t('mindmap.topbar.search.toggleReplace')}
                title={t('mindmap.topbar.search.toggleReplace')}
                onClick={toggleReplacePanel}
                className={showReplace ? 'text-primary' : undefined}
              >
                <ArrowLeftRight />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          {/* 替换输入框 */}
          <AnimatePresence>
            {showReplace && (
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.1 }}
              >
                <InputGroup>
                  <InputGroupAddon>
                    <RefreshCw />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={replaceText}
                    onChange={e => setReplaceText(e.target.value)}
                    placeholder={t('mindmap.topbar.search.replacePlaceholder')}
                  />
                  {replaceText && (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label="clear"
                        onClick={() => setReplaceText('')}
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </InputGroup>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReplace}
                    disabled={!searchText || !replaceText}
                    className="flex-1"
                  >
                    {t('mindmap.topbar.search.replaceCurrent')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReplaceAll}
                    disabled={!searchText || !replaceText}
                    className="flex-1"
                  >
                    {t('mindmap.topbar.search.replaceAll')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 搜索结果区域 */}
          {renderSearchResultsArea()}
        </div>
      </div>
    </div>
  )
}
