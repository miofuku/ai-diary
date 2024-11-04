'use client'

import { useState } from 'react'

export function ActivityPlanner() {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedActivity, setSelectedActivity] = useState<string>('')

  const handleSave = () => {
    // TODO: Save planned activity
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4">吉日规划</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            选择日期
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="w-full rounded-md border p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            选择事项
          </label>
          <select
            value={selectedActivity}
            onChange={e => setSelectedActivity(e.target.value)}
            className="w-full rounded-md border p-2"
          >
            <option value="">请选择</option>
            <option value="wedding">婚礼</option>
            <option value="moving">搬家</option>
            <option value="business">开业</option>
            {/* Add more options */}
          </select>
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-blue-500 text-white rounded-md py-2 hover:bg-blue-600"
        >
          保存
        </button>
      </div>
    </div>
  )
} 