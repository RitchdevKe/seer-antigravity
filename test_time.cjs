const targetDate = '2026-08-31';
const time = '23:30';

let matchDateTime = new Date(`${targetDate}T${time}:00Z`);
let isValidTime = !isNaN(matchDateTime.getTime());

if (isValidTime) {
    const eatOffsetMs = 3 * 60 * 60 * 1000;
    const eatDate = new Date(matchDateTime.getTime() + eatOffsetMs);
    
    let matchDateStr = eatDate.toISOString().split('T')[0];
    const h = eatDate.getUTCHours();
    const m = eatDate.getUTCMinutes();
    let adjustedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    console.log(`Original UTC: ${targetDate} ${time}`);
    console.log(`EAT Converted: ${matchDateStr} ${adjustedTime}`);
    console.log(`MatchDateTime (UTC): ${matchDateTime.toISOString()}`);
}
