import { RouterProvider } from "react-router-dom"
import { QueryProvider } from "@/components/providers/query-provider"
import { Toaster } from "@/components/ui/sonner"
import { router } from "@/routes"

function App() {
  return (
    <QueryProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </QueryProvider>
  )
}

export default App
