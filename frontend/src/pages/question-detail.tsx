import { useParams } from 'react-router-dom'

export function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">题目详情</h1>
      <p className="text-muted-foreground">题目 ID：{id}，待实现</p>
    </div>
  )
}
