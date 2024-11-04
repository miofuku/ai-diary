import Lunar from 'lunar-javascript';

// ... existing imports ...

interface DateDetailProps {
  date: Date;
  lunarDate: { year: number; month: number; day: number };
  onClose: () => void;
}

const getLunarInfo = (date: Date) => {
  const lunar = Lunar.Solar.fromDate(date).getLunar();
  return {
    yearInGanZhi: lunar.getYearInGanZhi() + '年',
    monthInGanZhi: lunar.getMonthInGanZhi() + '月',
    dayInGanZhi: lunar.getDayInGanZhi() + '日',
    monthInChinese: lunar.getMonthInChinese() + '月',
    dayInChinese: lunar.getDayInChinese()
  };
};

// ... rest of the file ...

// In your render section:
export const DateDetail: React.FC<DateDetailProps> = ({ date }) => {
  return (
    <div>
      <h4 className="font-medium mb-2">农历</h4>
      <p className="mb-1">{getLunarInfo(date).monthInChinese}{getLunarInfo(date).dayInChinese}</p>
      <p className="text-sm text-gray-600">
        {getLunarInfo(date).yearInGanZhi}
        {getLunarInfo(date).monthInGanZhi}
        {getLunarInfo(date).dayInGanZhi}
      </p>
    </div>
  );
};