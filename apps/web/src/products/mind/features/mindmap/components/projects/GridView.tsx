import { forwardRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ProjectCard from './ProjectCard'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'

interface GridViewProps {
  projects: ProjectWithStats[]
  onRename: (project: ProjectWithStats) => void
  onDelete: (project: ProjectWithStats) => void
  onToggleFavorite?: (project: ProjectWithStats) => void
  onUpdate: () => void
  onProjectClick?: (project: ProjectWithStats) => void
  onMove?: (project: ProjectWithStats) => void
}

const GridView = forwardRef<HTMLDivElement, GridViewProps>(
  ({ projects, onRename, onDelete, onToggleFavorite, onUpdate, onProjectClick, onMove }, ref) => {
    return (
      <motion.div
        ref={ref}
        key="grid-view"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-7 pb-8"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {projects.map(project => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                opacity: { duration: 0.2 },
                layout: {
                  type: 'spring',
                  stiffness: 350,
                  damping: 25
                }
              }}
            >
              <ProjectCard
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
GridView.displayName = 'GridView'

export default GridView
