import { CalendarView } from '@/components/calendar/CalendarView'
import { DailyForecast } from '@/components/calendar/DailyForecast'

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <div className="grid gap-6 md:grid-cols-2">
        <CalendarView />
        <DailyForecast />
      </div>
    </main>
  )
}