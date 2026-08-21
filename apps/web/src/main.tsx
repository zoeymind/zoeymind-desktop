import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"
import { configureLogger } from "@zoeymind/logger"
import { createTauriLogSink, initializePreferences } from "@/shared/native"
import { startDocumentPortalBrokerBridge } from "@/products/mind/document-portal/local-broker-bridge"

// 前端 log -> Rust file target 桥. 只在 Tauri 环境生效, 内部级别地板 = info.
configureLogger({ sinks: [createTauriLogSink()] })
startDocumentPortalBrokerBridge()

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", ({ updates }) => {
    if (updates.some(({ path }) => path.includes("/packages/simple-mind-map/src/"))) {
      window.location.reload()
    }
  })
}

void initializePreferences().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
