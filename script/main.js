let centralBlockOffset = 0;
const WEEKS_PER_BLOCK = 12;
const CURRENT_WEEK_INDEX = 3;

let app_state = {
  selected_element: null,
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

let previousScroll = 0;

let drag_state = {
  cells: null,
  backed_week: null,
  week: null,
  start_cell_num: 0,
  isCreated: false,
  isDragging: false,
  start_x: 0,
  start_y: 0,
  bar_holder: null,
  bar: null,
  prev_focus_num: 0,
};

function getCellNum(state, pos_x) {
  week_rect = state.week.getBoundingClientRect(); 

  rel_pos_x = pos_x-week_rect.left;
  return Math.floor(rel_pos_x/(week_rect.width/7.0));
}

function handleMouseDown(e) {
  if (e.button !== 0) return;

  drag_state.isDragging = true;
  drag_state.start_x = e.clientX;
  drag_state.start_y = e.clientY;

  let cell = e.target.closest(".day-cell");
  drag_state.week = cell.closest(".week-row");
  drag_state.backed_week = drag_state.week.cloneNode(true);
  drag_state.cells = drag_state.week.getElementsByClassName('day-cell');
  drag_state.start_cell_num = getCellNum(drag_state, e.clientX);
  drag_state.prev_focus_num = drag_state.start_cell_num;
}

function handleMouseUp(e) {
  drag_state.isCreated = false;
  drag_state.isDragging = false;
}

function shiftBarBy(bar, n) {
  bar.dataset.top = Number(bar.dataset.top)+n;
  bar.style.top = Number(bar.dataset.top)*20+'%';
}

function getEvents(cell) {
  list = cell.getElementsByClassName('bar-holder');
  if (list.length == 0) {
    return list;
  }
  return list[0].getElementsByClassName('event-occurence');
}

function addBarToCell(state) {
  let cell = state.cells[state.bar.dataset.leftCellNum];
  let list = cell.getElementsByClassName('bar-holder');
  if (list.length == 0) {
    state.bar_holder = document.createElement('div');
    state.bar_holder.classList.add('bar-holder');
    cell.appendChild(state.bar_holder);
  } else {
    state.bar_holder = list[0];
  }

  let rightMax = -1;
  for (i=0; i<state.bar.dataset.leftCellNum; i++) {
    let list = getEvents(state.cells[i]);
    let shifting = false;
    let shiftingFrom = 99;
    for (bar of list) {
      if (!shifting) {
        if (bar.dataset.rightCellNum >= state.bar.dataset.leftCellNum) {
          shifting = true;
          shiftingFrom = Math.min(bar.dataset.top, shiftingFrom);
          rightMax = Math.max(bar.dataset.rightCellNum, rightMax);
          shiftBarBy(bar, 1);
        } else if (bar.dataset.top > shiftingFrom) {
          shifting = true;
          rightMax = Math.max(bar.dataset.rightCellNum, rightMax);
          shiftBarBy(bar, 1);
        }
      } else {
          rightMax = Math.max(bar.dataset.rightCellNum, rightMax);
          shiftBarBy(bar, 1);
      }
    }
  }

  rightMax = Math.max(state.bar.dataset.rightCellNum, rightMax);
  for (i=state.bar.dataset.leftCellNum; i<=rightMax;i++) {
    let list = getEvents(state.cells[i]);
    for (bar of list) {
      rightMax = Math.max(bar.dataset.rightCellNum, rightMax);
      shiftBarBy(bar,1);
    }
  }

  state.bar_holder.insertBefore(state.bar, state.bar_holder.firstChild);
}

let event_counter = 1;

function handleMouseMove(e) {
  if (!drag_state.isDragging) return;

  const d = 50;
  if ((drag_state.start_x-e.clientX>d || drag_state.start_x-e.clientX<-d)
    && !drag_state.isCreated) {

    drag_state.bar = document.createElement('div');
    drag_state.bar.classList.add('event-occurence');
    drag_state.bar.classList.add('event-single');
    drag_state.bar.classList.add('no-select');
    drag_state.bar.textContent = 'Event #'+event_counter;
    event_counter+=1;

    drag_state.bar.dataset.rightCellNum = drag_state.start_cell_num;
    drag_state.bar.dataset.leftCellNum = drag_state.start_cell_num;
    drag_state.bar.dataset.top = 0;
    drag_state.bar.style.top = "0%";

    addBarToCell(drag_state);

    drag_state.isCreated = true;
  } else if (drag_state.isCreated) {

    const num = getCellNum(drag_state, e.clientX);
    if (num != drag_state.prev_focus_num) {
      drag_state.prev_focus_num = num;
      if (num > drag_state.start_cell_num) {
        drag_state.bar.dataset.rightCellNum = num;
      } else {
        drag_state.bar.dataset.leftCellNum = num;
        drag_state.bar.dataset.rightCellNum = drag_state.start_cell_num;
      }

      drag_state.bar_holder.removeChild(drag_state.bar);
      const replace = drag_state.backed_week.cloneNode(true);
      drag_state.week.replaceWith(replace);
      drag_state.week = replace;
      drag_state.cells = replace.getElementsByClassName('day-cell');
      addBarToCell(drag_state);

      let right_cell = drag_state.cells[drag_state.bar.dataset.rightCellNum]; 
      let left_cell = drag_state.cells[drag_state.bar.dataset.leftCellNum]; 

      let newWidth = right_cell.getBoundingClientRect().right-
        left_cell.getBoundingClientRect().left-1;
      drag_state.bar.style.width = newWidth+'px';
    }
  }
}

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

function handleClickOnEventButton(e) {
  console.log('handleClickOnEventButton');
  if (app_state.selected_element) {
    app_state.selected_element.style.backgroundColor = 'transparent';
  }
  e.style.backgroundColor = '#BF616A';
  app_state.selected_element = e;
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
