import { createBrowserRouter } from "react-router-dom"
import { MainLayout } from "@/components/layouts/main-layout"
import { HomePage } from "@/pages/home"
import { AboutPage } from "@/pages/about"
import { TodosPage } from "@/pages/todos"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "about",
        element: <AboutPage />,
      },
      {
        path: "todos",
        element: <TodosPage />,
      },
    ],
  },
])
