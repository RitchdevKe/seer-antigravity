const targetDate = '2026-08-30';
const time = '12:00';
const timeOffset = 10;
let matchDateStr = targetDate;
let adjustedTime = time;

let [hours, minutes] = time.split(':');
let h = parseInt(hours, 10);
let m = parseInt(minutes, 10);
h += Number(timeOffset);
if (h >= 24) {
    h = h % 24;
    const nextDay = new Date(targetDate + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    matchDateStr = nextDay.toISOString().split('T')[0];
} else if (h < 0) {
    h = (h % 24 + 24) % 24;
    const prevDay = new Date(targetDate + 'T00:00:00Z');
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    matchDateStr = prevDay.toISOString().split('T')[0];
}
adjustedTime = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');

console.log('Original:', targetDate, time);
console.log('Adjusted:', matchDateStr, adjustedTime);

const startDateObj = new Date('2026-08-30T12:00:00+03:00');
const endDateObj = new Date('2026-08-31T08:00:00+03:00');
const matchDateTime = new Date(matchDateStr + 'T' + adjustedTime + ':00+03:00');
console.log('matchDateTime:', matchDateTime);
console.log('start:', startDateObj);
console.log('end:', endDateObj);
console.log('is within:', matchDateTime >= startDateObj && matchDateTime <= endDateObj);
