import { useNavigate } from 'react-router-dom'
import { StageNotice } from '@/components/vn/StageNotice'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <StageNotice
      code="404"
      title="页面不存在"
      pose="thinking"
      line="唔……这一页不在题库里。可能是链接写错了，或者内容已经下线了。"
      choices={[
        { label: '返回首页', onSelect: () => navigate('/') },
        { label: '浏览全部题目', onSelect: () => navigate('/questions') },
        { label: '回到上一页', onSelect: () => navigate(-1) },
      ]}
    />
  )
}
