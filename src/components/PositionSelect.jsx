import { POSITIONS } from '@/lib/stats'

// ポジション選択(未設定も選べるネイティブselect)
export function PositionSelect({ id, value, onChange, className }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-md border bg-background px-3 text-sm ${className ?? ''}`}
    >
      <option value="">未設定</option>
      {POSITIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  )
}
