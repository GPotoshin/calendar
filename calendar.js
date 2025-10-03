let centralBlockOffset = 0;
const WEEKS_PER_BLOCK = 12;
const CURRENT_WEEK_INDEX = 3;

document.addEventListener('DOMContentLoaded', (event) => {
  const calendarBody = document.getElementById('calendar-body');
  const calendarContent = document.getElementById('calendar-content');

  const originalScrollBehavior = calendarBody.style.scrollBehavior;
  calendarBody.style.scrollBehavior = 'auto';

  const weeksBlock = calendarContent.querySelectorAll('.weeks-block')[0];
  const week = weeksBlock.querySelectorAll('.week-row')[0];
  calendarBody.scrollTop = week.offsetHeight*(12+3);
  calendarBody.style.scrollBehavior = originalScrollBehavior;
});
