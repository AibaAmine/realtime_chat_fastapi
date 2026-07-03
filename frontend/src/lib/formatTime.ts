const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMessageTime(isoString: string): string {
  return timeFormatter.format(new Date(isoString));
}

// Sidebar row timestamp: time-only for today, short date otherwise.
export function formatRoomTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return isSameDay(date, new Date()) ? timeFormatter.format(date) : dateFormatter.format(date);
}
