let centralBlockOffset = 0;
const WEEKS_PER_BLOCK = 12;
const CURRENT_WEEK_INDEX = 3;

function getPath(u) {
  try {
    const url_obj = new URL(u);
    return url_obj.pathname;
  } catch (e) {
    console.error("Invalid URL:", u, e);
    return "";
  }
}

let sideMenuIsOpen = false;
function handleClickOnSideMenuButton(button) {
  if (sideMenuIsOpen) {
    button.setAttribute('hx-target', '#side-menu');
    button.removeAttribute('hx-get');
    button.setAttribute('hx-swap', 'delete');
  } else {
    button.setAttribute('hx-get', '/api/side-menu');
    button.setAttribute('hx-target', '#side-menu-container');
    button.setAttribute('hx-swap', 'innerHTML');
  }

  sideMenuIsOpen ^= true;
}

function setMonthScrollPosition() {
  const calendarBody = document.getElementById('calendar-body');
  const calendarContent = document.getElementById('calendar-content');

  const originalScrollBehavior = calendarBody.style.scrollBehavior;
  calendarBody.style.scrollBehavior = 'auto';

  const week = calendarContent.querySelectorAll('.week-row')[0];
  calendarBody.scrollTop = week.offsetHeight*(6+3);
  calendarBody.style.scrollBehavior = originalScrollBehavior;
}

let cell = null;
let startWeek = null;
let previousScroll = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let isCreated = false;
let bar = null;

function handleMouseDown(e) {
  if (e.button !== 0) return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;

  cell = e.target;
  startWeek = cell.closest(".week-row");
}

function handleMouseUp(e) {
  isCreated = false;
  isDragging = false;
}

function handleMouseMove(e) {
  if (!isDragging) return;

  const d = 50
  if ((startX-e.clientX > d || startX-e.clientX < -d) && !isCreated) {
    isCreated = true;
    let barHolder = null;
    barHolderList = cell.getElementsByClassName('bar-holder');
    if (barHolderList.length == 0) {
      barHolder = document.createElement('div');
      barHolder.classList.add('bar-holder');
      cell.appendChild(barHolder);
    } else {
      barHolder = barHolderList[0];
    }

    bar = document.createElement('div');
    bar.classList.add('event-bar');
    bar.classList.add('event-single');
    bar.classList.add('no-select');
    bar.textContent = 'New Event';
    barHolder.appendChild(bar);
    console.log("creating div");
  } else if (isCreated) {
    if (e.target !== cell) {
      let start_pos = 0;
      let current_pos = 0;
      let cells = startWeek.getElementsByClassName('day-cell');

      for (i=0; i<7; i++) {
        if (cells[i] === cell) {
          start_pos = i
        } else if (cells[i] === e.target) {
          current_pos = i;
        }
      }

      if (current_pos > start_pos) {
        let newWidth = e.target.getBoundingClientRect().right-cell.getBoundingClientRect().left-1;
        bar.style.width = newWidth+'px';
      }
    } else {
      let newWidth = cell.getBoundingClientRect().width-1;
      bar.style.width = newWidth+'px';
    }
  }
}

document.addEventListener('DOMContentLoaded', (event) => {
  setMonthScrollPosition();
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.addEventListener('mousedown', handleMouseDown);
  calendarBody.addEventListener('mouseup', handleMouseUp);
  calendarBody.addEventListener('mousemove', handleMouseMove);
});

document.addEventListener('htmx:afterSwap', (event) => {
  const url = event.detail.xhr.responseURL;
  const path = getPath(url);

  if (path === '/' || path === '/view/month') {
        setMonthScrollPosition();
  } else if (path === '/api/scrolling-up') {
        const calendarBody = document.getElementById('calendar-body');
        const calendarContent = document.getElementById('calendar-content');
        const week = calendarContent.querySelectorAll('.week-row')[0];
        const originalScrollBehavior = calendarBody.style.scrollBehavior;
        calendarBody.style.scrollBehavior = 'auto';
        calendarBody.scrollTop = previousScroll + 6*week.offsetHeight;
        console.log("new scroll: ", calendarBody.scrollTop);
        calendarBody.style.scrollBehavior = originalScrollBehavior;
  } else if (path === '/api/scrolling-down') {
        const calendarBody = document.getElementById('calendar-body');
        const calendarContent = document.getElementById('calendar-content');
        const week = calendarContent.querySelectorAll('.week-row')[0];
        const originalScrollBehavior = calendarBody.style.scrollBehavior;
        calendarBody.style.scrollBehavior = 'auto';
        calendarBody.scrollTop = previousScroll - 6*week.offsetHeight;
        console.log("new scroll: ", calendarBody.scrollTop);
        calendarBody.style.scrollBehavior = originalScrollBehavior;
  }
});

document.addEventListener('htmx:beforeSwap', (event) => {
  const url = event.detail.xhr.responseURL;
  const path = getPath(url);

  if (path === '/api/scrolling-up' || path === '/api/scrolling-down') {
      previousScroll = document.getElementById("calendar-body").scrollTop;
      console.log("prev scroll: ", previousScroll);
  }
});
