export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export const formatDisplayDate = (dateStr: string | undefined, full = false) => {
  if (!dateStr) return '';
  
  // If it's a standard activity.formatted_date: YYYY-MM-DD HH:MM
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  let date: Date;
  
  if (match) {
    const [_, year, month, day, hour, minute] = match;
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  } else {
    // If it's ISO, remove 'Z' to treat as literal local time if 'Z' is present
    const cleanDateStr = dateStr.includes('T') ? dateStr.replace('Z', '') : dateStr;
    date = new Date(cleanDateStr);
  }

  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleString('en-US', { 
    weekday: full ? 'long' : undefined, 
    year: 'numeric', 
    month: full ? 'long' : 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatTimeStr = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
