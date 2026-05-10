export function nowIso() {
  return new Date().toISOString();
}

export function addHoursIso(dateIso: string, hours: number) {
  const date = new Date(dateIso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}
