declare const drawBackgroundImageToCanvas: (
  ctx: any,
  width: any,
  height: any,
  img: any,
  {
    backgroundSize,
    backgroundPosition,
    backgroundRepeat
  }: {
    backgroundSize: any
    backgroundPosition: any
    backgroundRepeat: any
  },
  callback?: (_e?: unknown) => void
) => void
export default drawBackgroundImageToCanvas
