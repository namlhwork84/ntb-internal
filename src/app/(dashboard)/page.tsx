import { Header } from '@/components/layout/Header'

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="Tổng quan hệ thống" />
      <div className="flex-1 p-6 flex items-center justify-center text-gray-400 text-sm">
        Dashboard tổng quan — Giai đoạn 2
      </div>
    </div>
  )
}
