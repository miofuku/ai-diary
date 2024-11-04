'use client'

export function LuckyColorCard() {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold mb-4">今日幸运色</h3>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {/* Color swatches */}
          <div className="w-20 h-20 rounded-full bg-red-500" title="红色" />
          <div className="w-20 h-20 rounded-full bg-yellow-500" title="金色" />
        </div>
        <div>
          <h4 className="font-medium">搭配建议</h4>
          <p className="text-gray-600">
            今日适合红色系搭配，可以选择红色或粉色的上衣，搭配金色饰品。
          </p>
        </div>
      </div>
    </div>
  )
} 