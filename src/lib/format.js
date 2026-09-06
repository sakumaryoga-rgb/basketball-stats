export function formatMadeAttempt(made, attempt) {
  return `${made}-${attempt}`
}

export function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
