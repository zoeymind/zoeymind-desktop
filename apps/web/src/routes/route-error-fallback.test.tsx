// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { initI18n, I18nProvider } from "@zoeymind/i18n"
import { ThemeProvider } from "@zoeymind/ui"
import { appLocales } from "@/locales"
import { RouteErrorFallback } from "./route-error-fallback"

vi.mock("@/components/layouts/titlebar", () => ({
  TitleBar: () => <div data-testid="titlebar" />,
}))

function BrokenRoute(): never {
  throw new Error("route-render-failure")
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("RouteErrorFallback", () => {
  beforeAll(async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
    await initI18n(appLocales).changeLanguage("zh-CN")
  })
  it("replaces React Router's default developer error page", async () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: <BrokenRoute />,
        errorElement: <RouteErrorFallback />,
      },
    ])

    render(
      <I18nProvider resources={appLocales}>
        <ThemeProvider defaultTheme="light">
          <RouterProvider router={router} />
        </ThemeProvider>
      </I18nProvider>
    )

    expect(await screen.findByRole("heading", { name: "页面遇到问题" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "重新加载" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "返回首页" })).toBeTruthy()
    expect(screen.getByText("route-render-failure")).toBeTruthy()
    expect(screen.queryByText(/Hey developer/i)).toBeNull()
  })
})
