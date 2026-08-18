// @ts-nocheck — vendored engine source
const backgroundStyleProps = [
  "backgroundColor",
  "backgroundImage",
  "backgroundRepeat",
  "backgroundPosition",
  "backgroundSize",
];

export const shapeStyleProps = [
  "gradientStyle",
  "startColor",
  "endColor",
  "startDir",
  "endDir",
  "fillColor",
  "borderColor",
  "borderWidth",
  "borderDasharray",
];

//  样式类
class Style {
  declare ctx: {
    mindMap: {
      themeConfig: Record<string, unknown>;
      painter?: unknown;
      opt: Record<string, unknown>;
    };
    isGeneralization: boolean;
    layerIndex: number;
    nodeDraw: Record<string, unknown>;
    lineDraw: Record<string, unknown>;
    getData(prop: string): unknown;
    effectiveStyles: Record<string, unknown>;
    [key: string]: unknown;
  };
  declare _markerPath: Record<string, unknown>;
  declare _marker: Record<string, unknown>;
  declare _gradient: Record<string, unknown>;
  declare hasCustomStyle: () => boolean;
  static cacheStyle: Record<string, string> | null = null;

  //   设置背景样式
  static setBackgroundStyle(el, themeConfig) {
    if (!el) return;
    // 缓存容器元素原本的样式
    if (!Style.cacheStyle) {
      Style.cacheStyle = {};
      const style = window.getComputedStyle(el);
      backgroundStyleProps.forEach((prop) => {
        if (Style.cacheStyle) {
          Style.cacheStyle[prop] = style[
            prop as keyof CSSStyleDeclaration
          ] as string;
        }
      });
    }
    // 设置新样式
    const {
      backgroundColor,
      backgroundImage,
      backgroundRepeat,
      backgroundPosition,
      backgroundSize,
    } = themeConfig;
    el.style.backgroundColor = backgroundColor;
    if (backgroundImage && backgroundImage !== "none") {
      el.style.backgroundImage = `url(${backgroundImage})`;
      el.style.backgroundRepeat = backgroundRepeat;
      el.style.backgroundPosition = backgroundPosition;
      el.style.backgroundSize = backgroundSize;
    } else {
      el.style.backgroundImage = "none";
    }
  }

  // 移除背景样式
  static removeBackgroundStyle(el) {
    if (!Style.cacheStyle) return;
    backgroundStyleProps.forEach((prop) => {
      (el.style as Record<string, string>)[prop] = (
        Style.cacheStyle as Record<string, string>
      )[prop];
    });
    Style.cacheStyle = null;
  }

  //  构造函数
  constructor(ctx) {
    this.ctx = ctx;
    // 箭头图标
    this._markerPath = null as unknown as Record<string, unknown>;
    this._marker = null as unknown as Record<string, unknown>;
    // 渐变背景
    this._gradient = null as unknown as Record<string, unknown>;
  }

  //  合并样式
  merge(prop, root?) {
    const themeConfig = this.ctx.mindMap.themeConfig;
    let defaultConfig: Record<string, unknown> | null = null;
    let useRoot = false;
    if (root) {
      // 使用最外层样式
      useRoot = true;
      defaultConfig = themeConfig;
    } else if (this.ctx.isGeneralization) {
      // 概要节点
      defaultConfig = themeConfig.generalization as Record<string, unknown>;
    } else if (this.ctx.layerIndex === 0) {
      // 根节点
      defaultConfig = themeConfig.root as Record<string, unknown>;
    } else if (this.ctx.layerIndex === 1) {
      // 二级节点
      defaultConfig = themeConfig.second as Record<string, unknown>;
    } else {
      // 三级及以下节点
      defaultConfig = themeConfig.node as Record<string, unknown>;
    }
    let value = "";
    // 优先使用节点本身的样式
    if (this.getSelfStyle(prop) !== undefined) {
      value = this.getSelfStyle(prop) as string;
    } else if (defaultConfig && defaultConfig[prop] !== undefined) {
      // 否则使用对应层级的样式
      value = defaultConfig[prop] as string;
    } else {
      // 否则使用最外层样式
      value = themeConfig[prop] as string;
    }
    if (!useRoot) {
      this.addToEffectiveStyles({
        [prop]: value,
      });
    }
    return value;
  }

  //  获取某个样式值
  getStyle(prop, root?) {
    return this.merge(prop, root);
  }

  //  获取自身自定义样式
  getSelfStyle(prop) {
    return this.ctx.getData(prop);
  }

  // 更新当前节点生效的样式数据
  addToEffectiveStyles(styles) {
    // effectiveStyles目前只提供给格式刷插件使用，所以如果没有注册该插件，那么不需要保存该数据
    if (!this.ctx.mindMap.painter) return;
    this.ctx.effectiveStyles = {
      ...this.ctx.effectiveStyles,
      ...styles,
    };
  }

  //  矩形
  rect(node) {
    this.shape(node);
    node.radius(this.merge("borderRadius"));
  }

  // 形状
  shape(node) {
    const styles: Record<string, unknown> = {};
    shapeStyleProps.forEach((key) => {
      styles[key] = this.merge(key);
    });
    if (styles.gradientStyle) {
      if (!this._gradient) {
        this._gradient = (
          this.ctx.nodeDraw as unknown as {
            gradient(type: string): Record<string, unknown>;
          }
        ).gradient("linear");
      }
      (
        this._gradient as unknown as {
          update(cb: (add: Record<string, unknown>) => void): void;
        }
      ).update((add: Record<string, unknown>) => {
        (add as unknown as { stop(pos: number, color: unknown): void }).stop(
          0,
          styles.startColor,
        );
        (add as unknown as { stop(pos: number, color: unknown): void }).stop(
          1,
          styles.endColor,
        );
      });
      (
        this._gradient as unknown as {
          from(...args: number[]): { to(...args: number[]): void };
        }
      )
        .from(...(styles.startDir as number[]))
        .to(...(styles.endDir as number[]));
      node.fill(this._gradient);
    } else {
      node.fill({
        color: styles.fillColor,
      });
    }
    node.stroke({
      color: styles.borderColor,
      width: styles.borderWidth,
      dasharray: styles.borderDasharray,
    });
  }

  //  文字
  text(node) {
    const styles: Record<string, unknown> = {
      color: this.merge("color"),
      fontFamily: this.merge("fontFamily"),
      fontSize: this.merge("fontSize"),
      fontWeight: this.merge("fontWeight"),
      fontStyle: this.merge("fontStyle"),
      textDecoration: this.merge("textDecoration"),
    };
    node
      .fill({
        color: styles.color,
      })
      .css({
        "font-family": styles.fontFamily,
        "font-size": String(styles.fontSize) + "px",
        "font-weight": styles.fontWeight,
        "font-style": styles.fontStyle,
        "text-decoration": styles.textDecoration,
      });
  }

  //  html文字节点
  domText(node, fontSizeScale = 1) {
    const styles: Record<string, unknown> = {
      color: this.merge("color"),
      fontFamily: this.merge("fontFamily"),
      fontSize: this.merge("fontSize"),
      fontWeight: this.merge("fontWeight"),
      fontStyle: this.merge("fontStyle"),
      textDecoration: this.merge("textDecoration"),
      textAlign: this.merge("textAlign"),
    };
    node.style.color = styles.color;
    node.style.textDecoration = styles.textDecoration;
    node.style.fontFamily = styles.fontFamily;
    node.style.fontSize = Number(styles.fontSize) * fontSizeScale + "px";
    node.style.fontWeight = styles.fontWeight || "normal";
    node.style.fontStyle = styles.fontStyle;
    node.style.textAlign = styles.textAlign;
  }

  //  标签文字
  tagText(node, style) {
    node
      .fill({
        color: "#fff",
      })
      .css({
        "font-size": String(style.fontSize) + "px",
      });
  }

  //  标签矩形
  tagRect(node, style) {
    node.fill({
      color: style.fill,
    });
    if (style.radius) {
      node.radius(style.radius);
    }
  }

  //  内置图标
  iconNode(node, color?) {
    node.attr({
      fill: color || this.merge("color"),
    });
  }

  //  连线
  line(
    line,
    { width, color, dasharray }: Record<string, unknown> = {},
    enableMarker?,
    childNode?,
  ) {
    const { customHandleLine } = this.ctx.mindMap.opt;
    if (typeof customHandleLine === "function") {
      customHandleLine(this.ctx, line, { width, color, dasharray });
    }
    line.stroke({ color, dasharray, width }).fill({ color: "none" });
    // 可以显示箭头
    if (enableMarker) {
      const showMarker = this.merge("showLineMarker", true);
      const childNodeStyle = childNode.style;
      // 显示箭头
      if (showMarker) {
        // 创建子节点箭头标记
        childNodeStyle._marker =
          childNodeStyle._marker || childNodeStyle.createMarker();
        // 设置样式
        childNodeStyle._markerPath.stroke({ color }).fill({ color });
        // 箭头位置可能会发生改变，所以需要先删除
        line.attr("marker-start", "");
        line.attr("marker-end", "");
        const dir = childNodeStyle.merge("lineMarkerDir");
        line.marker(dir, childNodeStyle._marker);
      } else if (childNodeStyle._marker) {
        // 不显示箭头，则删除该子节点的箭头标记
        line.attr("marker-start", "");
        line.attr("marker-end", "");
        childNodeStyle._marker.remove();
        childNodeStyle._marker = null;
      }
    }
  }

  // 创建箭头
  createMarker() {
    return (
      this.ctx.lineDraw as unknown as {
        marker(w: number, h: number, cb: (add: unknown) => void): unknown;
      }
    ).marker(20, 20, (add: unknown) => {
      const m = add as Record<string, unknown>;
      (m as unknown as { ref(x: number, y: number): void }).ref(8, 5);
      (m as unknown as { size(w: number, h: number): void }).size(20, 20);
      (m as unknown as { attr(name: string, value: string): void }).attr(
        "markerUnits",
        "userSpaceOnUse",
      );
      (m as unknown as { attr(name: string, value: string): void }).attr(
        "orient",
        "auto-start-reverse",
      );
      this._markerPath = (
        m as unknown as { path(d: string): Record<string, unknown> }
      ).path("M0,0 L2,5 L0,10 L10,5 Z");
    });
  }

  //  概要连线
  generalizationLine(node) {
    node
      .stroke({
        width: this.merge("generalizationLineWidth", true),
        color: this.merge("generalizationLineColor", true),
      })
      .fill({ color: "none" });
  }

  //  图标按钮
  iconBtn(openNode, closeNode, fillNode) {
    const expandBtnStyle = (this.ctx.mindMap.opt as Record<string, unknown>)
      .expandBtnStyle as Record<string, unknown>;
    this.iconNode(openNode, expandBtnStyle.color);
    this.iconNode(closeNode, expandBtnStyle.color);
    openNode.font({ size: expandBtnStyle.fontSize });
    fillNode.fill({ color: expandBtnStyle.fill });
    fillNode.stroke({
      color: expandBtnStyle.strokeColor,
      width: expandBtnStyle.strokeWidth,
    });
  }

  //  激活/悬浮节点
  hoverNode(hoverNode, width, height) {
    const {
      hoverRectColor,
      hoverRectPadding: padding,
      hoverRectBackdropColor,
    } = this.ctx.mindMap.opt as Record<string, unknown>;
    hoverNode.radius(this.merge("hoverRectRadius"));
    hoverNode.stroke({
      width: 2,
      color: hoverRectColor,
    });
    if (hoverRectBackdropColor) {
      hoverNode.fill({
        opacity: 0.2,
        color: hoverRectBackdropColor,
      });
    } else {
      hoverNode.fill({ opacity: 0 });
    }
  }

  //  光标聚焦节点
  focusNode(node) {
    node.fill({ opacity: 0.5 }).stroke({ color: "#fa541c", width: 2 }).back();
  }

  // 移除光标聚焦节点样式
  removeFocusNode(node) {
    node.fill({ opacity: 0 }).stroke({ color: "transparent", width: 0 });
  }

  //  当节点被删除时调用
  onRemove() {
    if (this._gradient) {
      (this._gradient as unknown as { remove(): void }).remove();
    }
  }
}

export default Style;
