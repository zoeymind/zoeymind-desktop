import { MetalFx } from "metal-fx";
import { type ComponentProps } from "react";

import { Button } from "./button";
import { cn } from "./cn";

type MetallicButtonProps = ComponentProps<typeof Button> & {
  metalTheme?: "dark" | "light" | "auto";
  metalScale?: number;
  metalPaused?: boolean;
};
function supportsWebGL(): boolean {
  return typeof WebGLRenderingContext !== "undefined";
}

function MetallicButton({
  className,
  children,
  metalTheme = "auto",
  metalScale = 1,
  metalPaused = false,
  ...props
}: MetallicButtonProps) {
  const button = (
    <Button
      data-slot="metallic-button"
      className={cn(
        "relative rounded-full border-0 bg-background px-3 text-foreground active:translate-y-0 active:scale-[0.96]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );

  if (!supportsWebGL()) return button;

  return (
    <MetalFx
      variant="button"
      borderRadius={Number.MAX_SAFE_INTEGER}
      preset="chromatic"
      theme={metalTheme}
      strength={0.7}
      paused={metalPaused}
      scale={metalScale}
      className="inline-flex rounded-full"
    >
      {button}
    </MetalFx>
  );
}

export { MetallicButton };
export type { MetallicButtonProps };
