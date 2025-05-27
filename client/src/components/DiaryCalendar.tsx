import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';

const tileContent = ({ date, view }: { date: Date; view: string }) => {
  if (view !== 'month') return null;

  const dateString = format(date, 'yyyy-MM-dd');
  const lunarDate = lunarDates[dateString];
  const solarTerm = solarTerms[dateString];
  const hasDiaryEntry = diaryEntries.some(entry => {
    const entryDate = new Date(entry.date);
    return (
      entryDate.getFullYear() === date.getFullYear() &&
      entryDate.getMonth() === date.getMonth() &&
      entryDate.getDate() === date.getDate()
    );
  });

  return (
    <div className={`tile-content ${solarTerm ? 'has-solar-term' : ''}`}>
      {hasDiaryEntry && <div className="diary-entry-dot" />}
      <span className="solar-day">{date.getDate()}</span>
      <span className="lunar-info">{lunarDate || '\u00A0'}</span>
      {solarTerm && <div className="tile-solar-term">{solarTerm}</div>}
    </div>
  );
};

export default tileContent; 