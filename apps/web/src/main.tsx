import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.tsx"

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", ({ updates }) => {
    if (updates.some(({ path }) => path.includes("/packages/simple-mind-map/src/"))) {
      window.location.reload()
    }
  })
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
