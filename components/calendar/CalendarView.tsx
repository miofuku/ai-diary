'use client'

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { convertToLunar } from '@/src/utils/lunarConverter';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  numberToChinese, 
  getLunarMonth, 
  getLunarDay, 
  getSolarTerm, 
  getFestivals 
} from '@/src/utils/dateUtils';
import { DateDetail } from './DateDetail';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  // 获取当月所有日期，包括用于填充的上月和下月日期
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const daysInCalendar = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-2">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {format(currentDate, 'yyyy年MM月')}
        </h2>
        <button onClick={handleNextMonth} className="p-2">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* 日历格子 */}
      <div className="grid grid-cols-7 gap-1">
        {daysInCalendar.map((date) => {
          const lunarDate = convertToLunar(date);
          const isCurrentMonth = date.getMonth() === currentDate.getMonth();
          const solarTerm = getSolarTerm(date);
          const festivals = getFestivals(date, lunarDate);
          
          return (
            <div
              key={date.toString()}
              className={`
                p-2 border rounded-md cursor-pointer hover:bg-gray-50
                ${isCurrentMonth ? '' : 'text-gray-400'}
              `}
              onClick={() => setSelectedDate(date)}
            >
              <div className="text-right">{format(date, 'd')}</div>
              <div className="text-xs text-gray-500">
                {getLunarDay(lunarDate.day)}
              </div>
              {solarTerm && (
                <div className="text-xs text-green-600">
                  {solarTerm}
                </div>
              )}
              {festivals.map(festival => (
                <div key={festival} className="text-xs text-red-600">
                  {festival}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* 日期详情弹窗 */}
      {selectedDate && (
        <DateDetail
          date={selectedDate}
          lunarDate={convertToLunar(selectedDate)}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
} 