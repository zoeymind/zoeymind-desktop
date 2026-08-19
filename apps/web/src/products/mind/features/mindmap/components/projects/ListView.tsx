import { forwardRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ProjectListItem from './ProjectListItem'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'
import { useTranslation } from '@zoeymind/i18n'

interface ListViewProps {
  projects: ProjectWithStats[]
  onRename: (project: ProjectWithStats) => void
  onDelete: (project: ProjectWithStats) => void
  onToggleFavorite?: (project: ProjectWithStats) => void // 新增收藏切换处理
  onUpdate: () => void
  onProjectClick?: (project: ProjectWithStats) => void // 新增自定义点击处理
  onMove?: (project: ProjectWithStats) => void
}

const ListView = forwardRef<HTMLDivElement, ListViewProps>(
  ({ projects, onRename, onDelete, onToggleFavorite, onUpdate, onProjectClick, onMove }, ref) => {
    const { t } = useTranslation()
    return (
      <motion.div
        ref={ref}
        key="list-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-1 pb-8"
      >
        {/* 列表标题头部 */}
        <div className="grid grid-cols-12 gap-4 items-center p-3 bg-muted/80 backdrop-blur-sm rounded-lg text-muted-foreground font-medium mb-2 sticky top-0 z-10">
          <div className="col-span-1 text-center">{t('projects.list.colPreview')}</div>
          <div className="col-span-4">{t('projects.list.colName')}</div>
          <div className="col-span-2">{t('projects.list.colCreated')}</div>
          <div className="col-span-1 text-center">{t('projects.list.colNodes')}</div>
          <div className="col-span-1 text-center">{t('projects.list.colMessages')}</div>
          <div className="col-span-2">{t('projects.list.colUpdated')}</div>
          <div className="col-span-1 text-center">{t('projects.list.colActions')}</div>
        </div>

        <AnimatePresence initial={false}>
          {projects.map(project => (
            <motion.div
              key={project.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              layout
              transition={{
                layout: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                },
                duration: 0.2
              }}
            >
              <ProjectListItem
                project={project}
                onRename={onRename}
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
                onUpdate={onUpdate}
                onProjectClick={onProjectClick}
                onMove={onMove}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    )
  }
)

// 添加显示名称以便调试
ListView.displayName = 'ListView'

export default ListView
