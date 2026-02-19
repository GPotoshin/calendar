import * as Global from './global.js';
import * as Utilities from './utilities.js';
import { palette } from './color.js';

let elements = {
  weeks: Global.elements.calendar_content.querySelectorAll('.week-row'),
  today_frame: null,
};

export const WEEK_COUNT = elements.weeks.length;
const MS_IN_DAY = 86400000;

const AVAILABLE = 0;
const NOT_AVAILABLE = -1;
const TAKEN = 1;

function getColor(type) {
  switch (type) {
    case AVAILABLE:
      return palette.green;
    case TAKEN:
      return palette.blue;
    default:
      return palette.red;
  }
}

// there is a mode of instantiating an event. it shows free day slots and etc.
export const public_state = {
  instantiating_event_identifier: undefined,
  is_instantiating: false,
  base_day_number: 0,
  view_day_data: new Uint32Array(WEEK_COUNT*7),
  bar_list: [], // contains all bars.
};

const state = {
  target: null,
  cells: null,
  week: null,
  start_cell_num: 0,
  is_updating: false,
  is_created: false,
  is_dragging: false,
  start_x: 0,
  bar_holder: null,
  bar: null,
  prev_focus_num: 0,
  focused_day_date: null,
  top_month_week_observer: null,
  bottom_month_week_observer: null,
  calendar_scrolling_observer: null,
  calendar_resize_observer: null,
};


export function init() {
  setMonthScrollPosition();
  state.calendar_resize_observer = new ResizeObserver(() => {
    for (const bar of public_state.bar_list) {
      const start = bar.closest('.day-cell')._index;
      const end = start+bar._width-1;
      resizeBar(bar, start, end);
    }
  });
  state.calendar_resize_observer.observe(Global.elements.calendar_content);

  state.top_month_week_observer = new IntersectionObserver((entries) => {
    let entry = entries[0]
    if (entry.isIntersecting) {
      state.focused_day_date.setMonth(state.focused_day_date.getMonth()-1);
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
      state.focused_day_date.setMonth(state.focused_day_date.getMonth()+1);
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
        elements.today_frame.classList.remove('today');
        const SHIFTING_BY = 5;
        let shifting_by = SHIFTING_BY;
        if (entry.target === Global.elements.marker_blocks[0]) {
          shifting_by = -SHIFTING_BY;
        }
        const week = elements.weeks[0];
        Global.elements.calendar_body.classList.replace('scroll-smooth', 'scroll-auto');
        // @nocheckin: We should scroll by a variable offset determined after
        // dom content modification.
          Global.elements.calendar_body.scrollTop -= shifting_by*week.offsetHeight;
        Global.elements.calendar_body.classList.replace('scroll-auto', 'scroll-smooth');
        requestAnimationFrame(() => {
          public_state.base_day_number += shifting_by*7;
          let date = new Date();
          const today = Math.floor(date.getTime()/MS_IN_DAY);
          const offset = today - public_state.base_day_number;

          date.setTime(public_state.base_day_number*MS_IN_DAY);
          const focusMonth = state.focused_day_date.getMonth();
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
  state.focused_day_date = new Date();
  const today_epoch = Math.floor(date.getTime() / MS_IN_DAY);
  const today_weekday = (date.getDay()+6)%7;
  elements.today_frame = Global.elements.calendar_content.children[8].children[today_weekday];
  elements.today_frame.classList.add('today');

  public_state.base_day_number = today_epoch-today_weekday-7*7;
  date.setTime(public_state.base_day_number*MS_IN_DAY);

  setMonthDisplay(state.focused_day_date);
  const focusMonth = state.focused_day_date.getMonth();
  
  const weeks = elements.weeks;
  for (let i = 0; i < weeks.length; i++) {
    weeks[i]._index = i;
    const days = weeks[i].querySelectorAll('.day-cell');
    for (let j = 0; j < days.length; j++) {
      days[j]._index = j; // docs: @set(day-cell._index)
    }
  }

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

function resizeBar(bar, start, end) {
  const week = elements.weeks[0];
  let new_width = week.children[end].getBoundingClientRect().right-
    week.children[start].getBoundingClientRect().left-1;
  bar.style.width = new_width+'px';
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
  setMonthDisplay(state.focused_day_date);
  let date = new Date();
  date.setTime(Number(Global.elements.calendar_content.children[0].children[0]._day_number)*MS_IN_DAY)
  const focusMonth = state.focused_day_date.getMonth();
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
  const month = state.focused_day_date.getMonth();

  let test_date = new Date(); // what is that?
  for (let i = 0; i < weeks.length; i++) {
    let row = weeks[i];
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
    let row = weeks[i];
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
  setMonthDisplay(state.focused_day_date);
  let date = new Date();
  const today = Math.floor(date.getTime()/MS_IN_DAY);
  const offset = today - public_state.base_day_number;
  date.setTime(public_state.base_day_number*MS_IN_DAY);
  const focusMonth = state.focused_day_date.getMonth();
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

  const week = elements.weeks[0];
  calendar_body.scrollTop = week.offsetHeight*7;
  calendar_body.style.scrollBehavior = original_scroll_behavior;
}

function getCellNum(pos_x) {
  const week_rect = state.week.getBoundingClientRect(); 
  const rel_pos_x = pos_x-week_rect.left;
  return Math.floor(rel_pos_x/(week_rect.width/7.0));
}

Global.elements.calendar_body.addEventListener('mousedown', e => {
  if (e.button !== 0 || !public_state.is_instantiating) return;

  state.is_dragging = true;
  state.start_x = e.clientX;
  state.target = e.target;


  state.week = e.target.closest('.week-row');
  state.cells = state.week.getElementsByClassName('day-cell');

  const clicked_cell_num = getCellNum(e.clientX);

  let bar = null;
  if (bar = e.target.closest('.event-occurence')) {
    const rect = bar.getBoundingClientRect();
    state.is_created = true;
    if (rect.right - e.clientX < e.clientX - rect.left) { // dragging right end
      state.start_cell_num = bar.closest('.day-cell')._index;
      state.prev_focus_num = state.start_cell_num + bar._width;
    } else { // dragging left end
      state.start_cell_num = state.start_cell_num + bar._width;
      state.prev_focus_num = bar.closest('.day-cell')._index;
    }
  } else {
    state.start_cell_num = clicked_cell_num;
    state.prev_focus_num = state.start_cell_num;
  }
});

Global.elements.calendar_body.addEventListener('mouseup', e => {
  let bar = null
  if (!state.is_creating && (bar = state.target.closest('.event-occurence'))) {
    bar.classList.toggle('highlight-border');
  }

  state.is_created = false;
  state.is_dragging = false;
});

function getEvents(cell) {
  const list = cell.getElementsByClassName('bar-holder');
  if (list.length == 0) {
    return list;
  }
  return list[0].getElementsByClassName('event-occurence');
}

function createBar(position, color) {
  let bar = document.createElement('div');
  bar.classList = 'event-occurence event-single no-select';
  bar.style.top = (20*position)+'%';
  Utilities.setBackgroundColor(bar, color);
  return bar;
}

export function renderBars() {
  for (const bar of public_state.bar_list) {
    bar.remove();
  }
  public_state.bar_list.length = 0;

  const base_day_number = public_state.base_day_number;
  const view_day_data = public_state.view_day_data;

  let start = 0;
  let end = 1;
  let region_type = view_day_data[0];
  for (; end < view_day_data.length; end++) {
    if (region_type !== view_day_data[end] || end % 7 === 0) {
      if (region_type !== NOT_AVAILABLE) {
        const week_number = Math.floor(start / 7);
        const week = elements.weeks[week_number];
        const start_day = start % 7;
        let end_day = (end-1) % 7;

        let bar = createBar(0, getColor(region_type));
        public_state.bar_list.push(bar);

        resizeBar(bar, start_day, end_day);
        if (region_type == TAKEN) {
          const event_indetifier = public_state.instantiating_event_identifier;
          if (!event_indetifier) {
            console.error('unreachable');
          }
          const event_index = Global.data.events_identifier_to_index_map.get(event_indetifier);
          bar.textContent = Global.data.events_name[event_index];
        } else {
          bar.textContent = 'Disponible';
        }
        bar._width = end_day-start_day+1; // docs: @set(bar._width)
        week.children[start_day].getElementsByClassName('bar-holder')[0].prepend(bar);
      }

      if (end >= view_day_data.length) {
        continue;
      }
      start = end;
      region_type = view_day_data[end];
    }
  }
}


Global.elements.calendar_body.addEventListener('mousemove', e => {
  if (!state.is_dragging) return;

  const d = 50;
  const week_shift = state.week._index*7; 
  const view_day_data = public_state.view_day_data;
  if ((state.start_x-e.clientX>d || state.start_x-e.clientX<-d)
    && !state.is_created) {
    
    if (public_state.view_day_data[state.start_cell_num+week_shift] === AVAILABLE) {
      public_state.view_day_data[state.start_cell_num+week_shift] = TAKEN;
      renderBars();
    }

    state.is_created = true;
  } else if (state.is_created) {
    const num = getCellNum(e.clientX);
    if (num === state.prev_focus_num) {
      return;
    }
    {
      let start = Math.min(state.prev_focus_num, num)+week_shift;
      let end = Math.max(state.prev_focus_num, num)+week_shift;
      for (let i = start; i <= end; i++) {
        if (view_day_data[i] === TAKEN) {
          view_day_data[i] = AVAILABLE;
        }
      }
    }
    state.prev_focus_num = num;

    if (state.start_cell_num <= num) {
      for (let i = state.start_cell_num+week_shift; i <= num+week_shift; i++) {
        if (public_state.view_day_data[i] === AVAILABLE) {
          public_state.view_day_data[i] = TAKEN;
        }
      }
    } else {
      for (let i = state.start_cell_num+week_shift; i >= num+week_shift; i--) {
        if (public_state.view_day_data[i] === AVAILABLE) {
          public_state.view_day_data[i] = TAKEN;
        }
      }
    }

    const left = Math.min(num, state.start_cell_num);
    const right = Math.max(num, state.start_cell_num);

    renderBars();
  }
});
