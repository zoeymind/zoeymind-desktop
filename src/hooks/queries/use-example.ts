import { useQuery } from "@tanstack/react-query"
// import { apiClient } from "@/lib/api"

interface ExampleData {
  id: string
  name: string
}

export function useExample() {
  return useQuery<ExampleData[]>({
    queryKey: ["example"],
    queryFn: async () => {
      // 示例：实际使用时替换为真实的 API 端点
      // return apiClient.get<ExampleData[]>("/api/example")

      // 模拟数据
      return new Promise(resolve => {
        setTimeout(() => {
          resolve([
            { id: "1", name: "示例数据 1" },
            { id: "2", name: "示例数据 2" },
          ])
        }, 1000)
      })
    },
  })
}
