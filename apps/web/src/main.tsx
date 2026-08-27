import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "katex/dist/katex.min.css"
import App from "./App.tsx"
import { configureLogger } from "@zoeymind/logger"
import { createTauriLogSink, initializePreferences, setupAppMenu } from "@/shared/native"
import { startDocumentPortalBrokerBridge } from "@/products/mind/document-portal/local-broker-bridge"
import { initI18n } from "@zoeymind/i18n"
import { appLocales } from "@/locales"
// 前端 log -> Rust file target 桥. 只在 Tauri 环境生效, 内部级别地板 = info.
configureLogger({ sinks: [createTauriLogSink()] })

// React 外的 native 单例由模块 HMR 生命周期统一释放。
let disposed = false
let teardownAppMenu: (() => void) | undefined
const teardownDocumentPortalBridge = startDocumentPortalBrokerBridge()
import.meta.hot?.dispose(() => {
  disposed = true
  teardownDocumentPortalBridge()
  teardownAppMenu?.()
})

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", ({ updates }) => {
    if (
      updates.some(
        ({ path }) =>
          path.includes("/packages/simple-mind-map/src/") ||
          path.includes("/products/mind/document-portal/")
      )
    ) {
      window.location.reload()
    }
  })
}

void initializePreferences().then(() => {
  if (disposed) return
  initI18n(appLocales)
  teardownAppMenu = setupAppMenu()

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
