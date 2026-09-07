// team_members.device_category(端末の用途区分)・role(役割)の表示用ラベル。
// device_categoryはplayers(選手ロスター)とは独立した概念で、
// コーチ・マネージャー・ベンチ端末・複数端末を持つ選手などいずれのケースにも対応する。
export const DEVICE_CATEGORIES = [
  { value: 'player', label: '選手本人' },
  { value: 'coach', label: 'コーチ' },
  { value: 'manager', label: 'マネージャー' },
  { value: 'bench', label: 'ベンチ端末' },
  { value: 'other', label: 'その他' },
]

export function deviceCategoryLabel(value) {
  return DEVICE_CATEGORIES.find((c) => c.value === value)?.label ?? '未設定'
}
