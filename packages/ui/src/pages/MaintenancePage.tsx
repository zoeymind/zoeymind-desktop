import { Button } from "../button";
import { Wrench, RefreshCw, Home } from "lucide-react";

interface MaintenancePageProps {
  title?: string;
  description?: string;
  estimatedTime?: string;
  showRefreshButton?: boolean;
  showHomeButton?: boolean;
  onRefresh?: () => void;
  onHome?: () => void;
}

/**
 * 维护页面 — shadcn 风格, 主题色全跟随.
 */
export function MaintenancePage({
  title = "系统维护中",
  description = "系统正在进行升级维护,为您带来更好的体验",
  estimatedTime,
  showRefreshButton = true,
  showHomeButton = true,
  onRefresh,
  onHome,
}: MaintenancePageProps) {
  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    else window.location.reload();
  };

  const handleHome = () => {
    onHome?.();
  };

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <Wrench className="size-8 text-muted-foreground animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {estimatedTime && (
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">预计完成时间:</strong>{" "}
              {estimatedTime}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          {showRefreshButton && (
            <Button onClick={handleRefresh} className="gap-2">
              <RefreshCw className="size-4" />
              刷新页面
            </Button>
          )}
          {showHomeButton && onHome && (
            <Button variant="outline" onClick={handleHome} className="gap-2">
              <Home className="size-4" />
              返回首页
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
