import { useState } from 'react'
import { X, FileText, ZoomIn } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogClose } from './dialog'
import { cn } from './cn'
import { VisuallyHidden } from './visually-hidden'
import { useTranslation } from '@zoeymind/i18n'

export interface MediaItem {
  id: string
  name: string
  url?: string
  file?: File
  type: 'image' | 'file'
}

export interface PreviewMediaProps {
  items: MediaItem[]
  onRemove?: (index: number) => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  scrollable?: boolean
  className?: string
}

export function PreviewMedia({
  items,
  onRemove,
  size = 'md',
  disabled = false,
  scrollable = false,
  className
}: PreviewMediaProps) {
  const { t } = useTranslation()
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // 无媒体项时不渲染
  if (!items || items.length === 0) {
    return null
  }

  // 根据尺寸类型设置容器大小
  const sizeClasses = {
    sm: 'size-8', // 小尺寸适用于输入框预览
    md: 'size-16', // 中等尺寸
    lg: 'size-24' // 大尺寸适用于消息附件
  }

  return (
    <>
      <div
        className={cn(
          'flex gap-2',
          scrollable ? 'overflow-x-auto scrollbar-none' : 'flex-wrap',
          className
        )}
      >
        {items.map((item, index) => {
          if (
            item.type === 'image' &&
            (item.url || (item.file && URL.createObjectURL(item.file)))
          ) {
            // 图片预览
            const imageUrl = item.url || (item.file ? URL.createObjectURL(item.file) : '')

            return (
              <div
                key={`image-${item.id || index}`}
                className={cn('relative group', sizeClasses[size])}
              >
                <div className="absolute inset-0 overflow-hidden rounded-lg border border-border">
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onClick={() => setPreviewImage(imageUrl)}
                  />
                  {/* 放大按钮 —— 与图片一起被 rounded 裁 */}
                  <div
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center cursor-pointer"
                    onClick={() => setPreviewImage(imageUrl)}
                  >
                    <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity size-3" />
                  </div>
                </div>

                {/* 删除按钮 —— 落在外层不裁的容器上，跑到卡片右上角外面 */}
                {onRemove && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      onRemove(index)
                    }}
                    disabled={disabled}
                    className={cn(
                      'absolute -top-1 -right-1 z-10 bg-destructive hover:bg-destructive/90 rounded-full',
                      size === 'sm' ? 'p-[1px]' : 'p-0.5',
                      'opacity-80 group-hover:opacity-100 transition-opacity',
                      disabled ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                    aria-label={t('ui.preview.deleteFile')}
                    title={t('ui.preview.deleteFile')}
                  >
                    <X className={cn('text-white', size === 'sm' ? 'size-2' : 'size-3')} />
                  </button>
                )}
              </div>
            )
          } else {
            // 文件预览
            return (
              <div
                key={`file-${item.id || index}`}
                className={cn(
                  'relative flex items-center justify-center rounded-lg border border-border bg-muted',
                  sizeClasses[size]
                )}
              >
                <div className="flex flex-col items-center">
                  <FileText
                    className={cn('text-muted-foreground', size === 'sm' ? 'size-4' : 'size-8')}
                  />
                  <span className="text-xs text-muted-foreground mt-1 line-clamp-2 text-center px-1">
                    {item.name}
                  </span>
                </div>

                {/* 删除按钮，仅在允许删除时显示 */}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={disabled}
                    className={cn(
                      'absolute -top-1 -right-1 bg-destructive hover:bg-destructive/90 rounded-full',
                      size === 'sm' ? 'p-[1px]' : 'p-0.5',
                      'opacity-80 group-hover:opacity-100 transition-opacity',
                      disabled ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                    aria-label={t('ui.preview.deleteFile')}
                    title={t('ui.preview.deleteFile')}
                  >
                    <X className={cn('text-white', size === 'sm' ? 'size-2' : 'size-3')} />
                  </button>
                )}
              </div>
            )
          }
        })}
      </div>

      {/* 图片预览对话框 */}
      <Dialog open={!!previewImage} onOpenChange={open => !open && setPreviewImage(null)}>
        <DialogContent
          className="flex items-center justify-center p-0 border-none sm:max-w-[90vw] max-h-[90vh] bg-black/80"
          onClick={e => e.target === e.currentTarget && setPreviewImage(null)}
        >
          <DialogTitle>
            <VisuallyHidden>{t('ui.preview.imagePreview')}</VisuallyHidden>
          </DialogTitle>

          <div className="relative max-w-full max-h-full ">
            {previewImage && (
              <img
                src={previewImage}
                alt={t('ui.preview.previewImage')}
                className="max-h-[80vh] max-w-[85vw] object-contain rounded-md"
                onClick={e => e.stopPropagation()}
              />
            )}

            <div className="absolute top-2 right-2">
              {/* 关闭按钮 */}
              <DialogClose
                className="bg-foreground/80 hover:bg-foreground rounded-full p-1.5 text-background"
                aria-label={t('ui.preview.close')}
                title={t('ui.preview.close')}
              >
                <X className="size-4" />
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
