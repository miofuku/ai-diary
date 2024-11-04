import { CalendarView } from '../../components/calendar/CalendarView'
import { DailyForecast } from '../../components/calendar/DailyForecast'

export default function CalendarPage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">黄历</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <CalendarView />
        <DailyForecast />
      </div>
    </main>
  )
} 