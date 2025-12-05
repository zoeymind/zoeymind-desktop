import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Plus } from "lucide-react"
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from "@/hooks/use-todo"
import { cn } from "@/lib/utils"

export function TodosPage() {
  const [inputValue, setInputValue] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all")

  const { data: todos = [], isLoading } = useTodos()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  const handleCreate = async () => {
    if (!inputValue.trim()) return

    await createTodo.mutateAsync({ title: inputValue.trim() })
    setInputValue("")
  }

  const handleToggle = async (id: number, completed: boolean) => {
    await updateTodo.mutateAsync({ id, input: { completed: !completed } })
  }

  const handleDelete = async (id: number) => {
    await deleteTodo.mutateAsync(id)
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === "active") return !todo.completed
    if (filter === "completed") return todo.completed
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">Todo 列表</h2>
        <p className="text-muted-foreground">使用 Tauri SQL 插件管理本地数据</p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="输入新的 todo..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                handleCreate()
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleCreate} disabled={createTodo.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            添加
          </Button>
        </div>

        <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">全部 ({todos.length})</TabsTrigger>
            <TabsTrigger value="active">
              未完成 ({todos.filter(t => !t.completed).length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              已完成 ({todos.filter(t => t.completed).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ) : filteredTodos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无 todo</div>
            ) : (
              <div className="space-y-2">
                {filteredTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-4 transition-colors",
                      todo.completed && "bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={todo.completed}
                      onCheckedChange={() => handleToggle(todo.id, todo.completed)}
                    />
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          todo.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {todo.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(todo.created_at * 1000).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(todo.id)}
                      disabled={deleteTodo.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
