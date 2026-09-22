const routeTimeZone = 'America/Mexico_City';

const routeDayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: routeTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getRoutePaymentDay(timestamp: string): string {
  const parts = routeDayFormatter.formatToParts(new Date(timestamp));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export function formatRoutePaymentDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('es-MX', {
    timeZone: routeTimeZone,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
