let centralBlockOffset = 0;
const WEEKS_PER_BLOCK = 12;
const CURRENT_WEEK_INDEX = 3;

function setMonthScrollPosition() {
  const calendarBody = document.getElementById('calendar-body');
  const calendarContent = document.getElementById('calendar-content');

  const originalScrollBehavior = calendarBody.style.scrollBehavior;
  calendarBody.style.scrollBehavior = 'auto';

  const week = calendarContent.querySelectorAll('.week-row')[0];
  calendarBody.scrollTop = week.offsetHeight*(12+3);
  calendarBody.style.scrollBehavior = originalScrollBehavior;
}

document.addEventListener('DOMContentLoaded', (event) => {
  setMonthScrollPosition();
});

document.addEventListener('htmx:afterSwap', (event) => {
  const swappedElement = event.detail.target;

  if (swappedElement.id === 'view-content') {
    const monthDisplay = swappedElement.querySelector('#month-display');

    if (monthDisplay) {
      setMonthScrollPosition();
    }
  }
});
