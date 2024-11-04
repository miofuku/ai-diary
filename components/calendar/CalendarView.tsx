'use client'

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { convertToLunar } from '@/src/utils/lunarConverter';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const handleDateClick = (date: Date) => {
    console.log('Selected date:', date);
    // 这里可以添加更多逻辑，例如打开一个详细信息模态框
  };

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
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((date) => {
          const lunarDate = convertToLunar(date);
          return (
            <div
              key={date.toString()}
              className="p-2 border rounded-md cursor-pointer hover:bg-gray-100"
              onClick={() => handleDateClick(date)}
            >
              <div>{format(date, 'd')}</div>
              <div className="text-sm text-gray-500">
                {lunarDate.month}月{lunarDate.day}日
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 