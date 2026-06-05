export function isPresalesMode(): boolean {
  const value = import.meta.env.VITE_HERMES_PRESALES_MODE
  if (value === undefined || value === '') return true
  return value !== '0' && value !== 'false'
}
