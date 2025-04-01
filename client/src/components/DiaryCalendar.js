import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function DiaryCalendar({ entries, onDateSelect, selectedDate }) {
  // Create a map of dates that have entries
  const datesWithEntries = entries.reduce((acc, entry) => {
    const date = new Date(entry.createdAt).toLocaleDateString();
    acc[date] = true;
    return acc;
  }, {});
  
  // Customize tile content to highlight dates with entries
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = date.toLocaleDateString();
      return datesWithEntries[dateStr] ? (
        <div className="diary-date-indicator"></div>
      ) : null;
    }
    return null;
  };

  return (
    <div className="diary-calendar">
      <Calendar 
        onChange={onDateSelect}
        value={selectedDate}
        tileContent={tileContent}
      />
    </div>
  );
}

export default DiaryCalendar; 