import * as Global from './global.js';

let elements = {
  today_frame: null,
};

let state = {
  cells: null,
  backed_week: null,
  week: null,
  start_cell_num: 0,
  is_updating: false,
  is_created: false,
  is_dragging: false,
  start_x: 0,
  start_y: 0,
  bar_holder: null,
  bar: null,
  prev_focus_num: 0,
  focused_day_date: null,
  base_day_number: 0,
  top_month_week_observer: null,
  bottom_month_week_observer: null,
  calendar_scrolling_observer: null,
};

const MS_IN_DAY = 86400000;

export function init() {
  setMonthScrollPosition();
  state.top_month_week_observer = new IntersectionObserver((entries) => {
    let entry = entries[0]
    if (entry.isIntersecting) {
      focused_day_date.setMonth(focus.date.getMonth()-1);
      refocusMonth();
      setMonthObserver();
    }
  }, {
    root: Global.elements.calendar_body,
    threshold: [1],
    rootMargin: '-66% 0px 0px 0px'
  });
  state.bottom_month_week_observer = new IntersectionObserver((entries) => {
    let entry = entries[0];
    if (entry.isIntersecting) {
      focused_day_date.setMonth(focus.date.getMonth()+1);
      refocusMonth();
      setMonthObserver();
    }
  }, {
    root: Global.elements.calendar_body,
    threshold: [1],
    rootMargin: '0px 0px -66% 0px'
  });
  state.calendar_scrolling_observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (state.is_updating) return;
        state.is_updating = true;
        Global.elements.today_frame.classList.remove('today');
        const SHIFTING_BY = 5;
        let shifting_by = SHIFTING_BY;
        if (entry.target === Global.elements.marker_blocks[0]) {
          shifting_by = -SHIFTING_BY;
        }
        const week = Global.elements.calendar_content.querySelectorAll('.week-row')[0];
        Global.elements.calendar_body.classList.replace('scroll-smooth', 'scroll-auto');
        // @nocheckin: We should scroll by a variable offset determined after
        // dom content modification.
          Global.elements.calendar_body.scrollTop -= shiftingBy*week.offsetHeight;
        Global.elements.calendar_body.classList.replace('scroll-auto', 'scroll-smooth');
        requestAnimationFrame(() => {
          state.base_day_number += shiftingBy*7;
          let date = new Date();
          const today = Math.floor(date.getTime()/MS_IN_DAY);
          const offset = today - state.base_day_number;

          date.setTime(state.base_day_number*MS_IN_DAY);
          const focusMonth = focus.date.getMonth();
          iterateOverDays((day) => {
            day.children[0].textContent = date.getDate();
            day._day_number = Math.floor(date.getTime() / MS_IN_DAY);
            if (day._day_number == today) {
              day.classList.add('today');
              elements.today_frame = day;
            }
            date.setDate(date.getDate() + 1);
          });
          refocusMonth();
          setMonthObserver();
          setTimeout(() => {
            state.is_updating = false;
          }, 100);
        });
      }
    });
  }, {
    root: Global.elements.calendar_body,
  });
  state.calendar_scrolling_observer.observe(Global.elements.marker_blocks[0]);
  state.calendar_scrolling_observer.observe(Global.elements.marker_blocks[1]);
  let date = new Date();
  focus.date = new Date();
  const today_epoch = Math.floor(date.getTime() / MS_IN_DAY);
  const today_weekday = (date.getDay()+6)%7;
  elements.today_frame = Global.elements.calendar_content.children[8].children[today_weekday];
  elements.today_frame.classList.add('today');

  state.base_day_number = today_epoch-today_weekday-7*7;
  date.setTime(state.base_day_number*MS_IN_DAY);

  setMonthDisplay(focus.date);
  const focusMonth = focus.date.getMonth();
  iterateOverDays((day) => {
    day.children[0].textContent = date.getDate();
    day._day_number = Math.floor(date.getTime() / MS_IN_DAY);
    if (date.getMonth() == focusMonth) {
      day.classList.add('focused-month');
    }
    date.setDate(date.getDate() + 1);
  });
  setMonthObserver(focus.month);
}


// sets year and month from `data` as a header
function setMonthDisplay(date) {
  const months = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];
  let monthHolder = document.createElement('strong');
  monthHolder.textContent = months[date.getMonth()];
  let year = document.createTextNode(" " + date.getFullYear());
  Global.elements.month_display.replaceChildren(monthHolder, year);
}

// runs a callback over all days in the displayed buffer
function iterateOverDays(dayCallback) {
  const rows = Global.elements.calendar_content.children;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    if (row.classList.contains('block-marker')) {
      continue;
    }
    for (let j = 0; j < row.children.length; j++) {
      dayCallback(row.children[j]);
    }
  }
}


function refocusMonth() {
  setMonthDisplay(focus.date);
  let date = new Date();
  date.setTime(Number(Global.elements.calendar_content.children[0].children[0]._day_number)*MS_IN_DAY)
  const focusMonth = focus.date.getMonth();
  iterateOverDays((day) => {
    if (date.getMonth() == focusMonth) {
      day.classList.add('focused-month');
    } else {
      day.classList.remove('focused-month');
    }
    date.setDate(date.getDate() + 1);
  });
}

function setMonthObserver() {
  state.top_month_week_observer.disconnect();
  state.bottom_month_week_observer.disconnect();
  const weeks = Global.elements.calendar_content.children;
  const month = focus.date.getMonth();

  let test_date = new Date(); // what is that?
  for (let i = 0; i < weeks.length; i++) {
    var row = weeks[i];
    if (row.classList.contains('block-marker')) {
      continue;
    }
    const day = row.children[6];
    test_date.setTime(Number(day._day_number)*MS_IN_DAY);
    if (test_date.getMonth() == month) {
      state.top_month_week_observer.observe(row);
      break;
    }
  }
  for (let i = weeks.length-1; i >= 0; i--) {
    var row = weeks[i];
    if (row.classList.contains('block-marker')) {
      continue;
    }
    const day = row.children[0];
    test_date.setTime(Number(day._day_number)*MS_IN_DAY);
    if (test_date.getMonth() == month) {
      state.bottom_month_week_observer.observe(row);
      break;
    }
  }
}

// @working: update function should update the calendar content with the
// new information. We had day number generation, now we need to have 
// a generation of evenents and hints. Plus we need to move all the code
// related to calendar rendering here and refactor and compress it if
// possible
export function update() {
  setMonthDisplay(focused_day_date);
  let date = new Date();
  const today = Math.floor(date.getTime()/MS_IN_DAY);
  const offset = today - state.base_day_number;
  date.setTime(state.base_day_number*MS_IN_DAY);
  const focusMonth = focus.date.getMonth();
  iterateOverDays((day) => {
    day.children[0].textContent = date.getDate();
    day._day_number = Math.floor(date.getTime() / MS_IN_DAY);
    if (day._day_number == today) {
      day.classList.add('today');
      Global.elements.today_frame = day;
    }
    date.setDate(date.getDate() + 1);
  });
  refocusMonth();
  setMonthObserver();
}

// @nocheckin: We should actually try to rerender the view and swap only
// when it is done and be at the correct scrollTop offset. Because that
// generation of dom can take a bit of time.

// [14/01/26:Potoshin] This function is only called in entry_point file once,
// so it should not exist.
export function setMonthScrollPosition() {
  const calendar_body = document.getElementById('calendar-body');
  const calendar_content = document.getElementById('calendar-content');

  const original_scroll_behavior = calendar_body.style.scrollBehavior;
  calendar_body.style.scrollBehavior = 'auto';

  const week = calendar_content.querySelectorAll('.week-row')[0];
  calendar_body.scrollTop = week.offsetHeight*7;
  calendar_body.style.scrollBehavior = original_scroll_behavior;
}

function getCellNum(pos_x) {
  const week_rect = state.week.getBoundingClientRect(); 

  const rel_pos_x = pos_x-week_rect.left;
  return Math.floor(rel_pos_x/(week_rect.width/7.0));
}

Global.elements.calendar_body.addEventListener('mousedown', e => {
  if (e.button !== 0) return;

  state.is_dragging = true;
  state.start_x = e.clientX;
  state.start_y = e.clientY;

  let cell = e.target.closest(".day-cell");
  state.week = cell.closest(".week-row");
  state.backed_week = state.week.cloneNode(true);
  state.cells = state.week.getElementsByClassName('day-cell');
  state.start_cell_num = getCellNum(e.clientX);
  state.prev_focus_num = state.start_cell_num;
});

Global.elements.calendar_body.addEventListener('mouseup', e => {
  state.is_created = false;
  state.is_dragging = false;
});

function shiftBarBy(bar, n) {
  bar._top = Number(bar._top)+n;
  bar.style.top = Number(bar._top)*20+'%';
}

function getEvents(cell) {
  const list = cell.getElementsByClassName('bar-holder');
  if (list.length == 0) {
    return list;
  }
  return list[0].getElementsByClassName('event-occurence');
}

function addBarToCell(state) {
  let cell = state.cells[state.bar._left_cell_num];
  let list = cell.getElementsByClassName('bar-holder');
  state.bar_holder = list[0];

  let i = 0;
  let rightMax = -1;
  for (i=0; i<state.bar._left_cell_num; i++) {
    let list = getEvents(state.cells[i]);
    let shifting = false;
    let shiftingFrom = 99;
    for (let bar of list) {
      if (!shifting) {
        if (bar._right_cell_num >= state.bar._left_cell_num) {
          shifting = true;
          shiftingFrom = Math.min(bar._top, shiftingFrom);
          rightMax = Math.max(bar._right_cell_num, rightMax);
          shiftBarBy(bar, 1);
        } else if (bar._top > shiftingFrom) {
          shifting = true;
          rightMax = Math.max(bar._right_cell_num, rightMax);
          shiftBarBy(bar, 1);
        }
      } else {
          rightMax = Math.max(bar._right_cell_num, rightMax);
          shiftBarBy(bar, 1);
      }
    }
  }

  rightMax = Math.max(state.bar._right_cell_num, rightMax);
  for (i=state.bar._left_cell_num; i<=rightMax;i++) {
    let list = getEvents(state.cells[i]);
    for (let bar of list) {
      rightMax = Math.max(bar._right_cell_num, rightMax);
      shiftBarBy(bar,1);
    }
  }

  state.bar_holder.insertBefore(state.bar, state.bar_holder.firstChild);
}

let event_counter = 1;

Global.elements.calendar_body.addEventListener('mousemove', e => {
  if (!state.is_dragging) return;

  const d = 50;
  if ((state.start_x-e.clientX>d || state.start_x-e.clientX<-d)
    && !state.is_created) {

    state.bar = document.createElement('div');
    state.bar.classList.add('event-occurence');
    state.bar.classList.add('event-single');
    state.bar.classList.add('no-select');
    
    const event_selection = Global.zones[Global.zones_identifier.EVENT].selection;
    if (event_selection != null) {
      const ev_identifier = event_selection._data_identifier;
      const index = Global.data.events_identifier.get(ev_id);
      const name = Global.data.events_name[index];
      state.bar.textContent = name;
    }
    else {
      state.bar.textContent = 'Event #'+event_counter;
      event_counter+=1;
    }

    state.bar._right_cell_num = state.start_cell_num;
    state.bar._left_cell_num = state.start_cell_num;
    state.bar._top = 0;
    state.bar.style.top = '0%';

    addBarToCell(state);

    state.is_created = true;
  } else if (state.is_created) {

    const num = getCellNum(e.clientX);
    if (num != state.prev_focus_num) {
      state.prev_focus_num = num;
      if (num > state.start_cell_num) {
        state.bar._right_cell_num = num;
      } else {
        state.bar._left_cell_num = num;
        state.bar._right_cell_num = state.start_cell_num;
      }

      state.bar_holder.removeChild(state.bar);
      const replace = state.backed_week.cloneNode(true);
      state.week.replaceWith(replace);
      state.week = replace;
      state.cells = replace.getElementsByClassName('day-cell');
      addBarToCell(state);

      let right_cell = state.cells[state.bar._right_cell_num]; 
      let left_cell = state.cells[state.bar._left_cell_num]; 

      let newWidth = right_cell.getBoundingClientRect().right-
        left_cell.getBoundingClientRect().left-1;
      state.bar.style.width = newWidth+'px';
    }
  }
});
