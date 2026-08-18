'use client'

import { motion } from 'motion/react'
import { Circle } from 'lucide-react'
import { cn } from '../../cn'

type ElegantShapeProps = {
  className?: string
  delay?: number
  width?: number
  height?: number
  rotate?: number
  gradient?: string
}

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = 'from-white/[0.08]'
}: ElegantShapeProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 }
      }}
      className={cn('absolute', className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0]
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut'
        }}
        style={{
          width,
          height
        }}
        className="relative"
      >
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            'bg-gradient-to-r to-transparent',
            gradient,
            'backdrop-blur-[2px] border-2 border-white/[0.15]',
            'shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]',
            'after:absolute after:inset-0 after:rounded-full',
            'after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]'
          )}
        />
      </motion.div>
    </motion.div>
  )
}

type HeroGeometricProps = {
  badge?: string
  title1?: string
  title2?: string
  description?: string
  className?: string
}

// 仅背景版本，不包含文字内容，适配浅色主题
function ElegantShapeLight({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = 'from-primary/[0.08]'
}: ElegantShapeProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 }
      }}
      className={cn('absolute', className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0]
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut'
        }}
        style={{
          width,
          height
        }}
        className="relative"
      >
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            'bg-gradient-to-r to-transparent',
            gradient,
            'backdrop-blur-[2px] border border-primary/10',
            'shadow-[0_8px_32px_0_hsla(var(--foreground)_/_0.05)]',
            'after:absolute after:inset-0 after:rounded-full',
            'after:bg-[radial-gradient(circle_at_50%_50%,hsla(var(--foreground)_/_0.05),transparent_70%)]'
          )}
        />
      </motion.div>
    </motion.div>
  )
}

// 仅背景版本，不包含文字内容
export function HeroBackground({ className }: { className?: string }) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {/* 背景渐变，加入主题色 */}
      <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 via-primary/3 to-chart-2/5 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-tl from-chart-3/4 via-transparent to-chart-4/4 blur-3xl opacity-50" />

      {/* 使用不同主题色的形状 */}
      <ElegantShapeLight
        delay={0.3}
        width={600}
        height={140}
        rotate={12}
        gradient="from-chart-1/[0.12]"
        className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
      />

      <ElegantShapeLight
        delay={0.5}
        width={500}
        height={120}
        rotate={-15}
        gradient="from-chart-2/[0.10]"
        className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
      />

      <ElegantShapeLight
        delay={0.4}
        width={300}
        height={80}
        rotate={-8}
        gradient="from-chart-3/[0.08]"
        className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
      />

      <ElegantShapeLight
        delay={0.6}
        width={200}
        height={60}
        rotate={20}
        gradient="from-chart-4/[0.10]"
        className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
      />

      <ElegantShapeLight
        delay={0.7}
        width={150}
        height={40}
        rotate={-25}
        gradient="from-primary/[0.06]"
        className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
      />

      {/* 添加更多小形状增强层次感 */}
      <ElegantShapeLight
        delay={0.8}
        width={100}
        height={30}
        rotate={35}
        gradient="from-chart-5/[0.08]"
        className="right-[30%] md:right-[35%] bottom-[20%] md:bottom-[25%]"
      />

      <ElegantShapeLight
        delay={0.9}
        width={120}
        height={35}
        rotate={-30}
        gradient="from-chart-1/[0.06]"
        className="left-[40%] md:left-[45%] top-[50%] md:top-[55%]"
      />
    </div>
  )
}

export function HeroGeometric({
  badge = 'shadcn.io',
  title1 = 'Elevate Your Digital Vision',
  title2 = 'Crafting Exceptional Websites',
  description = 'Crafting exceptional digital experiences through innovative design and cutting-edge technology.',
  className
}: HeroGeometricProps) {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1] as const
      }
    })
  }

  return (
    <div
      className={cn(
        'relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background',
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] blur-3xl" />

      <div className="absolute inset-0 overflow-hidden">
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="from-indigo-500/[0.15]"
          className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]"
        />

        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="from-rose-500/[0.15]"
          className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]"
        />

        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="from-violet-500/[0.15]"
          className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
        />

        <ElegantShape
          delay={0.6}
          width={200}
          height={60}
          rotate={20}
          gradient="from-amber-500/[0.15]"
          className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]"
        />

        <ElegantShape
          delay={0.7}
          width={150}
          height={40}
          rotate={-25}
          gradient="from-cyan-500/[0.15]"
          className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-8 md:mb-12"
          >
            <Circle className="size-2 fill-rose-500/80" />
            <span className="text-sm text-white/60 tracking-wide">{badge}</span>
          </motion.div>

          <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible">
            <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-6 md:mb-8 tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                {title1}
              </span>
              <br />
              <span
                className={cn(
                  'bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300'
                )}
              >
                {title2}
              </span>
            </h1>
          </motion.div>

          <motion.div custom={2} variants={fadeUpVariants} initial="hidden" animate="visible">
            <p className="text-base sm:text-lg md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
              {description}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/80 pointer-events-none" />
    </div>
  )
}

export type { HeroGeometricProps, ElegantShapeProps }
