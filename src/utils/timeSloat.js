// Helper: Convert 24-hour to 12-hour format
const format12Hour = (hour) => {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${period}`;
};

// Time slots (24-hour logic)
export const TIME_SLOTS = [
  { start: 9, end: 10 },
  { start: 10, end: 11 },
  { start: 11, end: 12 },
  { start: 12, end: 13 },
  { start: 13, end: 14 },
  { start: 14, end: 15 },
  { start: 15, end: 16 },
  { start: 16, end: 17 },
].map(slot => ({
  ...slot,
  label: `${format12Hour(slot.start)} - ${format12Hour(slot.end)}`
}));

// Auto-select time slot based on current time
export const getAutoTimeSlot = () => {
  const now = new Date();
  const hour = now.getHours();

  // current slot
  const slot = TIME_SLOTS.find(
    s => hour >= s.start && hour < s.end
  );

  if (slot) return slot.label;

  // fallback → next future slot
  const nextSlot = TIME_SLOTS.find(s => s.start > hour);
  return nextSlot ? nextSlot.label : TIME_SLOTS.at(-1).label;
};
