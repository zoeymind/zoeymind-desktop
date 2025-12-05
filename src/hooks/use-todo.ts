import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Database from "@tauri-apps/plugin-sql"
import { toast } from "sonner"
import type { CreateTodoInput, Todo, UpdateTodoInput } from "@/types/todo"

const DB_NAME = "sqlite:todos.db"

// 初始化数据库
async function initDatabase() {
  const db = await Database.load(DB_NAME)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `)

  return db
}

// 获取所有 todos
async function getTodos(): Promise<Todo[]> {
  const db = await Database.load(DB_NAME)
  const todos = await db.select<Todo[]>("SELECT * FROM todos ORDER BY created_at DESC")
  return todos
}

// 创建 todo
async function createTodo(input: CreateTodoInput): Promise<Todo> {
  const db = await Database.load(DB_NAME)

  const result = await db.execute("INSERT INTO todos (title, completed) VALUES ($1, $2)", [
    input.title,
    false,
  ])

  const todos = await db.select<Todo[]>("SELECT * FROM todos WHERE id = $1", [result.lastInsertId])

  return todos[0]
}

// 更新 todo
async function updateTodo(id: number, input: UpdateTodoInput): Promise<Todo> {
  const db = await Database.load(DB_NAME)

  const updates: string[] = []
  const params: unknown[] = []
  let paramIndex = 1

  if (input.title !== undefined) {
    updates.push(`title = $${paramIndex}`)
    params.push(input.title)
    paramIndex++
  }

  if (input.completed !== undefined) {
    updates.push(`completed = $${paramIndex}`)
    params.push(input.completed ? 1 : 0)
    paramIndex++
  }

  if (updates.length === 0) {
    throw new Error("No fields to update")
  }

  params.push(id)
  await db.execute(`UPDATE todos SET ${updates.join(", ")} WHERE id = $${paramIndex}`, params)

  const todos = await db.select<Todo[]>("SELECT * FROM todos WHERE id = $1", [id])
  return todos[0]
}

// 删除 todo
async function deleteTodo(id: number): Promise<void> {
  const db = await Database.load(DB_NAME)
  await db.execute("DELETE FROM todos WHERE id = $1", [id])
}

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: async () => {
      await initDatabase()
      return getTodos()
    },
  })
}

export function useCreateTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      toast.success("Todo 创建成功")
    },
    onError: error => {
      toast.error(`创建失败: ${error.message}`)
    },
  })
}

export function useUpdateTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTodoInput }) => updateTodo(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      toast.success("Todo 更新成功")
    },
    onError: error => {
      toast.error(`更新失败: ${error.message}`)
    },
  })
}

export function useDeleteTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] })
      toast.success("Todo 删除成功")
    },
    onError: error => {
      toast.error(`删除失败: ${error.message}`)
    },
  })
}
