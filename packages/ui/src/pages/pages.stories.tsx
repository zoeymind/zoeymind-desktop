import type { Meta, StoryObj } from '@storybook/react'
import { ErrorPage } from './ErrorPage'
import { LoadingPage } from './LoadingPage'
import { LoginRequiredPage } from './LoginRequiredPage'
import { MaintenancePage } from './MaintenancePage'
import { NotFoundPage } from './NotFoundPage'
import { RequestAccessPage } from './RequestAccessPage'
import { UnauthorizedPage } from './UnauthorizedPage'

const meta: Meta = {
  title: 'Pages',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    router: true
  }
}

export default meta

export const NotFound: StoryObj = {
  name: '404 · NotFound',
  render: () => <NotFoundPage />
}

export const Loading: StoryObj = {
  name: 'Loading',
  render: () => <LoadingPage />
}

export const LoginRequired: StoryObj = {
  name: '401 · LoginRequired',
  render: () => <LoginRequiredPage />
}

export const Unauthorized: StoryObj = {
  name: '401 · Unauthorized',
  render: () => <UnauthorizedPage />
}

export const Maintenance: StoryObj = {
  name: '维护中',
  render: () => <MaintenancePage estimatedTime="约 30 分钟" />
}

export const ErrorGeneric: StoryObj = {
  name: '错误页',
  render: () => (
    <ErrorPage
      code="500"
      title="服务异常"
      description="服务器暂时不可用，请稍后重试。"
      error="TypeError: Cannot read property 'foo' of undefined"
    />
  )
}

export const RequestAccess: StoryObj = {
  name: '申请访问',
  render: () => (
    <RequestAccessPage
      card={{
        title: '市场调研 2026 Q3',
        workspaceName: 'ZoeyMind 工作空间',
        creator: { name: '张三', email: 'zhang@zoey.dev' }
      }}
      message=""
      onMessageChange={() => {}}
      onRequest={() => {}}
      onBack={() => {}}
    />
  )
}
