let state = {
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

// @nocheckin: We should actually try to rerender the view and swap only
// when it is done and be at the correct scrollTop offset. Because that
// generation of dom can take a bit of time.

// [14/01/26:Potoshin] This function is only called in entry_point file once,
// so it should not exist.
export function setMonthScrollPosition() {
  const calendarBody = document.getElementById('calendar-body');
  const calendarContent = document.getElementById('calendar-content');

  const originalScrollBehavior = calendarBody.style.scrollBehavior;
  calendarBody.style.scrollBehavior = 'auto';

  const week = calendarContent.querySelectorAll('.week-row')[0];
  calendarBody.scrollTop = week.offsetHeight*7;
  calendarBody.style.scrollBehavior = originalScrollBehavior;
}

function getCellNum(pos_x) {
  const week_rect = state.week.getBoundingClientRect(); 

  const rel_pos_x = pos_x-week_rect.left;
  return Math.floor(rel_pos_x/(week_rect.width/7.0));
}

export function handleMouseDown(e) {
  if (e.button !== 0) return;

  state.isDragging = true;
  state.start_x = e.clientX;
  state.start_y = e.clientY;

  let cell = e.target.closest(".day-cell");
  state.week = cell.closest(".week-row");
  state.backed_week = state.week.cloneNode(true);
  state.cells = state.week.getElementsByClassName('day-cell');
  state.start_cell_num = getCellNum(e.clientX);
  state.prev_focus_num = state.start_cell_num;
}

export function handleMouseUp(e) {
  state.isCreated = false;
  state.isDragging = false;
}

function shiftBarBy(bar, n) {
  bar.dataset.top = Number(bar.dataset.top)+n;
  bar.style.top = Number(bar.dataset.top)*20+'%';
}

function getEvents(cell) {
  const list = cell.getElementsByClassName('bar-holder');
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

  let i = 0;
  let rightMax = -1;
  for (i=0; i<state.bar.dataset.leftCellNum; i++) {
    let list = getEvents(state.cells[i]);
    let shifting = false;
    let shiftingFrom = 99;
    for (let bar of list) {
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
    for (let bar of list) {
      rightMax = Math.max(bar.dataset.rightCellNum, rightMax);
      shiftBarBy(bar,1);
    }
  }

  state.bar_holder.insertBefore(state.bar, state.bar_holder.firstChild);
}

let event_counter = 1;

export function handleMouseMove(e) {
  if (!state.isDragging) return;

  const d = 50;
  if ((state.start_x-e.clientX>d || state.start_x-e.clientX<-d)
    && !state.isCreated) {

    state.bar = document.createElement('div');
    state.bar.classList.add('event-occurence');
    state.bar.classList.add('event-single');
    state.bar.classList.add('no-select');
    state.bar.textContent = 'Event #'+event_counter;
    event_counter+=1;

    state.bar.dataset.rightCellNum = state.start_cell_num;
    state.bar.dataset.leftCellNum = state.start_cell_num;
    state.bar.dataset.top = 0;
    state.bar.style.top = "0%";

    addBarToCell(state);

    state.isCreated = true;
  } else if (state.isCreated) {

    const num = getCellNum(e.clientX);
    if (num != state.prev_focus_num) {
      state.prev_focus_num = num;
      if (num > state.start_cell_num) {
        state.bar.dataset.rightCellNum = num;
      } else {
        state.bar.dataset.leftCellNum = num;
        state.bar.dataset.rightCellNum = state.start_cell_num;
      }

      state.bar_holder.removeChild(state.bar);
      const replace = state.backed_week.cloneNode(true);
      state.week.replaceWith(replace);
      state.week = replace;
      state.cells = replace.getElementsByClassName('day-cell');
      addBarToCell(state);

      let right_cell = state.cells[state.bar.dataset.rightCellNum]; 
      let left_cell = state.cells[state.bar.dataset.leftCellNum]; 

      let newWidth = right_cell.getBoundingClientRect().right-
        left_cell.getBoundingClientRect().left-1;
      state.bar.style.width = newWidth+'px';
    }
  }
}
