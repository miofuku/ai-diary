'use client'

import { useState } from 'react'
import { useStore } from '@/src/lib/store'

export function BaziForm() {
  const [formData, setFormData] = useState({
    solarDate: '',
    solarTime: '',
    gender: '',
    location: ''
  })
  const setBirthData = useStore(state => state.setBirthData)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Convert solar to lunar date
    // TODO: Save to store
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            出生日期
          </label>
          <input
            type="date"
            value={formData.solarDate}
            onChange={e => setFormData(prev => ({ ...prev, solarDate: e.target.value }))}
            className="w-full rounded-md border p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            出生时间
          </label>
          <input
            type="time"
            value={formData.solarTime}
            onChange={e => setFormData(prev => ({ ...prev, solarTime: e.target.value }))}
            className="w-full rounded-md border p-2"
          />
        </div>
        {/* Add gender and location inputs */}
        <button
          type="submit"
          className="w-full bg-blue-500 text-white rounded-md py-2 hover:bg-blue-600"
        >
          生成八字
        </button>
      </div>
    </form>
  )
} 