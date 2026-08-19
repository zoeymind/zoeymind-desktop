import { useLayoutEffect, type FC } from "react";
import { Loader2 } from "lucide-react";
import { Progress } from "./progress";
import { AnimatedGridPattern } from "./animated-grid-pattern";

interface LoadingProps {
  tip: string;
  className?: string;
  show: boolean;
  progress?: number; // 可选的进度值 (0-100)
  logoSrc?: string;
}

// 全局标记，确保样式只插入一次
let stylesInjected = false;

export const Loading: FC<LoadingProps> = ({
  tip,
  className = "",
  show,
  progress,
  logoSrc,
}) => {
  // 检查是否是思维导图相关的loading
  const isMindMapLoading =
    tip.includes("思维导图") ||
    tip.includes("云端文档") ||
    tip.includes("协作") ||
    tip.includes("同步") ||
    tip.includes("初始化云端画布") ||
    tip.includes("准备协作环境") ||
    tip.includes("建立实时协作连接");

  // 是否显示进度条：传入了progress值 或者 是思维导图相关loading
  const showProgress = typeof progress === "number" || isMindMapLoading;
  // 进度值：优先使用传入的progress，否则默认为0
  const progressValue = typeof progress === "number" ? progress : 0;

  // 使用useLayoutEffect避免闪烁，并优化样式注入
  useLayoutEffect(() => {
    if (!stylesInjected && typeof document !== "undefined") {
      const style = document.createElement("style");
      style.id = "loading-animations";
      style.textContent = `
        @keyframes logo-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }
        @keyframes logo-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.95;
          }
        }
        @keyframes logo-shadow-float {
          0%, 100% {
            box-shadow: 0 8px 24px hsl(var(--shadow-color));
          }
          50% {
            box-shadow: 0 16px 40px hsl(var(--shadow-hover));
          }
        }
        .logo-container {
          animation: logo-float 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          will-change: transform;
        }
        .logo-container img {
          display: block;
          animation: logo-pulse 2s ease-in-out infinite, logo-shadow-float 2.5s ease-in-out infinite;
          animation-delay: 0s, 0s;
        }
        .loading-container {
          /* 提升渲染优先级 */
          contain: layout style paint;
        }
      `;
      document.head.appendChild(style);
      stylesInjected = true;
    }
  }, []);

  // 如果不需要显示，直接返回null避免渲染
  if (!show) {
    return null;
  }

  return (
    <div
      className={`
        loading-container
        fixed inset-x-0 top-10 bottom-0 flex flex-col items-center justify-center
        bg-background
        z-30 transition-all duration-300 ease-out
        ${show ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"}
        ${className}
      `}
      style={{
        transform: show
          ? "translate3d(0,0,0) scale(1)"
          : "translate3d(0,0,0) scale(0.98)",
        isolation: "isolate",
      }}
    >
      {/* Animated Grid Pattern 背景 - 只在显示时渲染 */}
      {show && (
        <AnimatedGridPattern
          className="opacity-40"
          width={40}
          height={40}
          numSquares={30}
          maxOpacity={0.3}
          duration={3}
        />
      )}
      <div className="flex flex-col items-center relative z-10">
        {/* 品牌 Logo 由宿主应用传入，避免 UI 包依赖不存在的静态资源目录。 */}
        {logoSrc && (
          <div className="logo-container mb-8">
            <img
              src={logoSrc}
              alt="ZoeyMind"
              className="h-14 w-auto"
              loading="eager"
              decoding="sync"
            />
          </div>
        )}

        {/* 加载图标和提示文字 */}
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="size-5 animate-spin text-primary" />
          <div className="text-muted-foreground font-medium text-base select-none">
            {tip}
          </div>
        </div>

        {/* 显示进度条 */}
        {showProgress && (
          <div className="w-64">
            <Progress
              value={progressValue}
              className="w-full h-2 bg-muted [&>div]:bg-primary [&>div]:rounded-full [&>div]:transition-all [&>div]:duration-300"
            />
          </div>
        )}
      </div>
    </div>
  );
};
