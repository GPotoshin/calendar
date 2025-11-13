import {
  setMonthScrollPosition,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} from './scrollable_calendar.js';

let state = {
  sideMenuIsOpen: false,
  selected_element: null,
  previousScroll: 0,
};

function getPath(u) {
  try {
    const url_obj = new URL(u);
    return url_obj.pathname;
  } catch (e) {
    console.error("Invalid URL:", u, e);
    return "";
  }
}
window.getPath = getPath;

function handleClickOnSideMenuButton(button) {
  if (state.sideMenuIsOpen) {
    button.setAttribute('hx-target', '#side-menu');
    button.removeAttribute('hx-get');
    button.setAttribute('hx-swap', 'delete');
  } else {
    button.setAttribute('hx-get', '/api/side-menu');
    button.setAttribute('hx-target', '#side-menu-container');
    button.setAttribute('hx-swap', 'innerHTML');
  }

  state.sideMenuIsOpen ^= true;
}
window.handleClickOnSideMenuButton = handleClickOnSideMenuButton;


document.addEventListener('DOMContentLoaded', (event) => {
  setMonthScrollPosition();
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.addEventListener('mousedown', handleMouseDown);
  calendarBody.addEventListener('mouseup', handleMouseUp);
  calendarBody.addEventListener('mousemove', handleMouseMove);

  const sideMenu = document.getElementById('side-menu-container');
  sideMenu.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    let menu = document.getElementById('right-click-menu');
    menu.style.display = 'flex';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
  });
});

function handleClick(event) {
  let menu = document.getElementById('create-option-menu');
  if (!menu.contains(event.target)) {
    menu.style.display = 'none';
  }
  document.removeEventListener('click', handleClick);
};

let handleTyping = null;

document.addEventListener('click', function(event) {
  let menu = document.getElementById('right-click-menu');
  menu.style.display = 'none';

  let input = menu.querySelectorAll('input')[0];
  input.removeEventListener('input', handleTyping);

  if (event.target.id == 'new-event-button') {
    menu = document.getElementById('create-option-menu');
    document.addEventListener('click', handleClick);
  }
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
    calendarBody.scrollTop = state.previousScroll + 6*week.offsetHeight;
    console.log("new scroll: ", calendarBody.scrollTop);
    calendarBody.style.scrollBehavior = originalScrollBehavior;
  } else if (path === '/api/scrolling-down') {
    const calendarBody = document.getElementById('calendar-body');
    const calendarContent = document.getElementById('calendar-content');
    const week = calendarContent.querySelectorAll('.week-row')[0];
    const originalScrollBehavior = calendarBody.style.scrollBehavior;
    calendarBody.style.scrollBehavior = 'auto';
    calendarBody.scrollTop = state.previousScroll - 6*week.offsetHeight;
    console.log("new scroll: ", calendarBody.scrollTop);
    calendarBody.style.scrollBehavior = originalScrollBehavior;
  }
});

document.addEventListener('htmx:beforeSwap', (event) => {
  const url = event.detail.xhr.responseURL;
  const path = getPath(url);

  if (path === '/api/scrolling-up' || path === '/api/scrolling-down') {
    state.previousScroll = document.getElementById("calendar-body").scrollTop;
    console.log("prev scroll: ", state.previousScroll);
  }
});

function handleClickOnEventButton(e) {
  console.log('handleClickOnEventButton');
  if (state.selected_element) {
    state.selected_element.style.backgroundColor = 'transparent';
  }
  e.style.backgroundColor = '#BF616A';
  state.selected_element = e;
}


function handleCreateNewEvent() {
  let menu = document.getElementById("side-menu");
  let new_button = document.createElement('button');
  new_button.classList.add('event-button');
  new_button.textContent = "Nouvel Événement";
  new_button.setAttribute('onclick', 'handleClickOnEventButton(this)');
  menu.appendChild(new_button);

  
  const rect = new_button.getBoundingClientRect();
  menu = document.getElementById('create-option-menu');
  menu.style.display = 'flex';
  menu.style.left = rect.right + 'px';
  menu.style.top = rect.top + 'px';

  let input = menu.querySelectorAll('input')[0];
  input.focus();
  
  handleTyping = function(event) {
    if (event.target.value === "") {
      new_button.textContent = "Nouvel Événement";
    } else {
      new_button.textContent = event.target.value;
    }
  };

  input.addEventListener('input', handleTyping);
}
window.handleCreateNewEvent = handleCreateNewEvent;
