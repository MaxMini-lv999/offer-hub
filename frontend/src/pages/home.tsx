import { AlertCircle, Eye, Fire } from 'reicon-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useHotQuestions } from '@/hooks/use-hot-questions'

export function HomePage() {
  const { data, isPending, isError, error, refetch } = useHotQuestions({ limit: 10 })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fire size={20} className="text-orange-500" />
          热门题目
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && <p className="text-sm text-muted-foreground">加载中...</p>}

        {isError && (
          <div className="flex items-center gap-3 text-sm text-destructive">
            <AlertCircle size={18} />
            <span>{error.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        )}

        {data && (
          <ul className="divide-y">
            {data.list.map((q) => (
              <li key={q.question_id} className="flex items-center justify-between py-3">
                <span>{q.title}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Eye size={16} />
                  {q.view_count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
