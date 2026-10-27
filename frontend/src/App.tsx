import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { QueryProvider } from '@/components/provider/query-provider'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'
import { QuestionCollectionsPage } from '@/pages/QuestionCollections'
import { QuestionDetailPage } from '@/pages/question-detail'
import { QuestionsPage } from '@/pages/Questions'

export default function App() {
  return (
    <QueryProvider>
      {/* 提前启用 v7 行为，消除控制台的 Future Flag 警告 */}
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/collections" element={<QuestionCollectionsPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/questions/:id" element={<QuestionDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryProvider>
  )
}
