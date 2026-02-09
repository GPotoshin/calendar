import * as Glob from './global_state.js';

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
  focused_day_date: null,
  base_day_number: 0,
  top_month_week_observer: null,
  bottom_month_week_observer: null,
  calendar_scrolling_observer: null,
};

export function init() {
  setMonthScrollPosition();
  state.top_month_week_observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        focused_day_date.setMonth(focus.date.getMonth()-1);
        refocusMonth();
        setMonthObserver();
      }
    });
  }, {
    root: elements.calendar_body,
    threshold: [1],
    rootMargin: '-66% 0px 0px 0px'
  });
  state.bottom_month_week_observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        focused_day_date.setMonth(focus.date.getMonth()+1);
        refocusMonth();
        setMonthObserver();
      }
    });
  }, {
    root: elements.calendar_body,
    threshold: [1],
    rootMargin: '0px 0px -66% 0px'
  });
  state.calendar_scrolling_observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (state.isUpdating) return;
        state.isUpdating = true;
        elements.todayFrame.classList.remove('today');
        const SHIFTING_BY = 5;
        let shiftingBy = SHIFTING_BY;
        if (entry.target === elements.marker_blocks[0]) {
          shiftingBy = -SHIFTING_BY;
        }
        const week = elements.calendar_content.querySelectorAll('.week-row')[0];
        elements.calendar_body.classList.replace('scroll-smooth', 'scroll-auto');
        // @nocheckin: We should scroll by a variable offset determined after
        // dom content modification.
          elements.calendar_body.scrollTop -= shiftingBy*week.offsetHeight;
        elements.calendar_body.classList.replace('scroll-auto', 'scroll-smooth');
        requestAnimationFrame(() => {
          state.baseDayNumber += shiftingBy*7;
          let date = new Date();
          const today = Math.floor(date.getTime()/MS_IN_DAY);
          const offset = today - state.baseDayNumber;

          date.setTime(state.baseDayNumber*MS_IN_DAY);
          const focusMonth = focus.date.getMonth();
          iterateOverDays((day) => {
            day.children[0].textContent = date.getDate();
            day._dayNum = Math.floor(date.getTime() / MS_IN_DAY);
            if (day._dayNum == today) {
              day.classList.add('today');
              elements.todayFrame = day;
            }
            date.setDate(date.getDate() + 1);
          });
          refocusMonth();
          setMonthObserver();
          setTimeout(() => {
            state.isUpdating = false;
          }, 100);
        });
      }
    });
  }, {
    root: elements.calendar_body,
  });
  state.calendar_scrolling_observer.observe(elements.marker_blocks[0]);
  state.calendar_scrolling_observer.observe(elements.marker_blocks[1]);
  let date = new Date();
  focus.date = new Date();
  const today_epoch = Math.floor(date.getTime() / MS_IN_DAY);
  const today_weekday = (date.getDay()+6)%7;
  elements.todayFrame = elements.calendar_content.children[8].children[today_weekday];
  elements.todayFrame.classList.add('today');

  state.baseDayNumber = today_epoch-today_weekday-7*7;
  date.setTime(state.baseDayNumber*MS_IN_DAY);

  setMonthDisplay(focus.date);
  const focusMonth = focus.date.getMonth();
  iterateOverDays((day) => {
    day.children[0].textContent = date.getDate();
    day._dayNum = Math.floor(date.getTime() / MS_IN_DAY);
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
  elements.month_display.replaceChildren(monthHolder, year);
}

// runs a callback over all days in the displayed buffer
function iterateOverDays(dayCallback) {
  const list = elements.calendar_content.children;
  for (let i = 0; i < list.length; i++) {
    var el = list[i];
    if (el.classList.contains('block-marker')) {
      continue;
    }
    for (let j = 0; j < el.children.length; j++) {
      dayCallback(el.children[j]);
    }
  }
}


function refocusMonth() {
  setMonthDisplay(focus.date);
  let date = new Date();
  date.setTime(Number(elements.calendar_content.children[0].children[0]._dayNum)*MS_IN_DAY)
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

function dateFromDayNum(n) {
  let date = new Date();
  date.setTime(Number(n)*MS_IN_DAY);
}

function setMonthObserver() {
  state.top_month_week_observer.disconnect();
  state.bottom_month_week_observer.disconnect();
  const weeks = elements.calendar_content.children;
  const month = focus.date.getMonth();

  let testDate = new Date();
  for (let i = 0; i < weeks.length; i++) {
    var el = weeks[i];
    if (el.classList.contains('block-marker')) {
      continue;
    }
    const day = el.children[6];
    testDate.setTime(Number(day._dayNum)*MS_IN_DAY);
    if (testDate.getMonth() == month) {
      observers.topWeek.observe(el);
      break;
    }
  }
  for (let i = weeks.length-1; i >= 0; i--) {
    var el = weeks[i];
    if (el.classList.contains('block-marker')) {
      continue;
    }
    const day = el.children[0];
    testDate.setTime(Number(day._dayNum)*MS_IN_DAY);
    if (testDate.getMonth() == month) {
      observers.bottomWeek.observe(el);
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
  date.setTime(state.baseDayNumber*MS_IN_DAY);
  const focusMonth = focus.date.getMonth();
  iterateOverDays((day) => {
    day.children[0].textContent = date.getDate();
    day._dayNum = Math.floor(date.getTime() / MS_IN_DAY);
    if (day._dayNum == today) {
      day.classList.add('today');
      elements.todayFrame = day;
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

  const originalScrollBehavior = calendar_body.style.scrollBehavior;
  calendar_body.style.scrollBehavior = 'auto';

  const week = calendar_content.querySelectorAll('.week-row')[0];
  calendar_body.scrollTop = week.offsetHeight*7;
  calendar_body.style.scrollBehavior = originalScrollBehavior;
}

function getCellNum(pos_x) {
  const week_rect = state.week.getBoundingClientRect(); 

  const rel_pos_x = pos_x-week_rect.left;
  return Math.floor(rel_pos_x/(week_rect.width/7.0));
}

elements.calendar_body.addEventListener('mousedown', e => {
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
});

elements.calendar_body.addEventListener('mouseup', e => {
  state.isCreated = false;
  state.isDragging = false;
});

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
  state.bar_holder = list[0];

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

elements.calendar_body.addEventListener('mousemove', e => {
  if (!state.isDragging) return;

  const d = 50;
  if ((state.start_x-e.clientX>d || state.start_x-e.clientX<-d)
    && !state.isCreated) {

    state.bar = document.createElement('div');
    state.bar.classList.add('event-occurence');
    state.bar.classList.add('event-single');
    state.bar.classList.add('no-select');
    
    const event_selection = Glob.zones[Glob.zones_identifier.EVENT].selection;
    if (event_selection != null) {
      const ev_identifier = event_selection._data_identifier;
      const idx = Glob.data.eventsId.get(ev_id);
      const name = Glob.data.eventsName[idx];
      state.bar.textContent = name;
    }
    else {
      state.bar.textContent = 'Event #'+event_counter;
      event_counter+=1;
    }

    state.bar.dataset.rightCellNum = state.start_cell_num;
    state.bar.dataset.leftCellNum = state.start_cell_num;
    state.bar.dataset.top = 0;
    state.bar.style.top = '0%';

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
});
