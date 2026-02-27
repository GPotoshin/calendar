import * as Global from './global.js';
import * as Utilities from './utilities.js';
import * as Api from './api.js';
import * as Io from './io.js';
import * as DM from './data_manager.js';
import { palette } from './color.js';

const Int32Slice = DM.Int32Slice;

let elements = {
  weeks: Global.elements.calendar_content.querySelectorAll('.week-row'),
  days:  Global.elements.calendar_content.querySelectorAll('.day-cell'),
  today_frame: null,
};

export const WEEK_COUNT = elements.weeks.length;
const DAY_COUNT = WEEK_COUNT*7;
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

const state = {
  target: null,
  cells: null,
  week: null,
  start_cell_num: 0,
  prev_focus_num: 0,
  is_updating: false,
  is_created: false,
  is_dragging: false,
  is_selected: false,
  is_instantiating: false,
  start_x: 0,
  bar_holder: null,
  bar: null,
  focused_day_date: null,
  selection_intervals: [],
  top_month_week_observer: null,
  bottom_month_week_observer: null,
  calendar_scrolling_observer: null,
  calendar_resize_observer: null,
  instantiating_event_identifier: undefined,
  view_day_data: new Uint32Array(WEEK_COUNT*7),
  base_day_number: 0,
  bar_list: [], // contains all bars.
  selected_day_counter: 0,
};


export function init() {
  setMonthScrollPosition();
  state.calendar_resize_observer = new ResizeObserver(() => {
    for (const bar of state.bar_list) {
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
          Global.elements.calendar_body.scrollTop -= shifting_by*week.offsetHeight;
        Global.elements.calendar_body.classList.replace('scroll-auto', 'scroll-smooth');
        requestAnimationFrame(() => {
          state.base_day_number += shifting_by*7;
          let date = new Date();
          const today = Math.floor(date.getTime()/MS_IN_DAY);
          const offset = today - state.base_day_number;

          date.setTime(state.base_day_number*MS_IN_DAY);
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
          renderBars();
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

  state.base_day_number = today_epoch-today_weekday-7*7;
  date.setTime(state.base_day_number*MS_IN_DAY);

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

export function startInstantiating(identifier) {
  state.is_instantiating = true;
  state.instantiating_event_identifier = identifier;
  state.selected_day_counter = 0;
  state.selection_intervals = [];
  renderBars();
  document.addEventListener("keydown", saveSelectionsCallback);
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
  const offset = today - state.base_day_number;
  date.setTime(state.base_day_number*MS_IN_DAY);
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
  if (e.button !== 0 || !state.is_instantiating) return;

  // handle highlighting
  let new_bar = e.target.closest('.event-occurrence');
  if (state.is_selected) {
    let old_bar = state.target.closest('.event-occurrence');
    if (new_bar !== old_bar) {
      state.target.closest('.event-occurrence').classList.remove('highlight-border');
      state.is_selected = false;
      document.removeEventListener("keydown", deleteSelectedElement);
    }
  }

  state.is_dragging = true;
  state.start_x = e.clientX;
  state.target = e.target;

  state.week = e.target.closest('.week-row');
  state.cells = state.week.getElementsByClassName('day-cell');

  const clicked_cell_num = getCellNum(e.clientX);

  if (new_bar && new_bar._type === TAKEN) {
    const rect = new_bar.getBoundingClientRect();
    state.is_created = true;
    if (rect.right - e.clientX < e.clientX - rect.left) { // dragging right end
      state.start_cell_num = new_bar.closest('.day-cell')._index;
      state.prev_focus_num = state.start_cell_num + new_bar._width-1;
    } else { // dragging left end
      state.prev_focus_num = new_bar.closest('.day-cell')._index;
      state.start_cell_num = state.prev_focus_num + new_bar._width-1;
    }
  } else {
    const duration = Global.getEventsDuration(state.instantiating_event_identifier);
    if (duration <= state.selected_day_counter) {
      state.is_dragging = false;
      return;
    }

    state.start_cell_num = clicked_cell_num;
    state.prev_focus_num = state.start_cell_num;
  }
});

Global.elements.calendar_body.addEventListener('mouseup', e => {
  let bar = null
  if (!state.is_creating && !state.is_instantiating && (bar = state.target.closest('.event-occurrence')) &&
  bar._type === TAKEN) {
    bar.classList.toggle('highlight-border');
    if (state.is_selected ^= true) {
      document.addEventListener("keydown", deleteSelectedElement);
    } else {
      document.removeEventListener("keydown", deleteSelectedElement);
    }
  }

  state.is_created = false;
  state.is_dragging = false;
});


/**
 * erases [start, end] from all entreis of `intervals`
 * 
 @param {number[][]} intervals
 @param {number}     start
 @param {number}     end
*/
function eraseInterval(intervals, start, end) {
  for (let i = 0; i < intervals.length; i++) {
    if (intervals[i][0] <= end && intervals[i][1] >= start) {
      if (intervals[i][0] < start && intervals[i][1] > end) {
        intervals.push([end+1, intervals[i][1]]);
        intervals[i][1] = start-1;
      } else if (intervals[i][0] < start) {
        intervals[i][1] = start-1;
      } else if (intervals[i][1] > end) {
        intervals[i][0] = end+1;
      } else {
        intervals.splice(i, 1);
      }
    }
  }
}

function deleteSelectedElement(e) {
  if (e.key === "Backspace") {
    const bar = state.target.closest('.event-occurrence');
    const day = bar.closest('.day-cell');
    const day_number = day._day_number;
    const week = day.closest('.week-row');
    const week_shift = week._index*7;
    const start = day._index+week_shift;
    const end = start+bar._width-1;
    for (let i = start; i <= end; i++) {
      state.view_day_data[i]=AVAILABLE;
    }
    state.selected_day_counter -= bar._width;
    const intervals = state.selection_intervals;
    eraseInterval(intervals, day_number, day_number+bar._width-1);
    renderBars();
  }
}

/**
 @param {Event} e
*/
function saveSelectionsCallback(e) {
  if (e.key === "Enter") {
    state.is_instantiating = false;
    document.removeEventListener("keydown", saveSelectionsCallback);
    renderBars();
    const event_identifier = state.instantiating_event_identifier; 
    const intervals = state.selection_intervals;
    const writer = Api.createBufferWriter(Api.CREATE, Api.OCCURRENCES_MAP);
    Io.writeInt32(writer, event_identifier);
    Io.writeArrayOfInt32Pairs(writer, intervals);

    Api.request(writer).then(response => {
      Utilities.throwIfNotOk(response);
      response.arrayBuffer().then(binary => {
        const reader = new Io.BufferReader(binary);
        const identifier = Io.readInt32(reader);
        const free_list = Global.data.occurrences_free_list;
        const map = Global.data.occurrences_map;
        const index = DM.storageIndex(map, free_list);

        map.set(identifier, index);
        Global.data.occurrences_venue[index] = -1;
        Global.data.occurrences_event_identifiers[index] = event_identifier;
        Global.data.occurrences_dates[index] = intervals;
        Global.data.occurrences_participants[index] = [];

        const day_occurrences = Global.data.day_occurrences;
        if (day_occurrences.length === 0) {
          Global.data.base_day_number = intervals[0][0];
        }
        const base_day = Global.data.base_day_number;
        const last_idx = intervals.length - 1;
        const end_day = base_day + day_occurrences.length - 1;
        const prefix_diff = Math.max(base_day - intervals[0][0], 0);
        const postfix_diff = Math.max(intervals[last_idx][1] - end_day, 0);
        const old_len = day_occurrences.length;
        const diff = prefix_diff+postfix_diff;
        const new_len = old_len+diff;
        
        if (prefix_diff > 0) {
          Global.data.base_day_number = intervals[0][0];
          for (let i = old_len-1; i >= 0; i--) {
            day_occurrences[i + prefix_diff] = day_occurrences[i] || [];
          }
        }

        for (const interval of intervals) {
          const start = interval[0]-Global.data.base_day_number;
          const end   = interval[1]-Global.data.base_day_number;
          for (let i = start; i <= end; i++) {
            if (!day_occurrences[i]) {
              day_occurrences[i] = [];
            }
            day_occurrences[i].push(identifier);
          }
        }

        state.view_day_data.fill(0);
        renderBars();
      });
    }).catch(e => {
        console.error("Could not store ", e);
    });
  }
}

function getEvents(cell) {
  const list = cell.getElementsByClassName('bar-holder');
  if (list.length == 0) {
    return list;
  }
  return list[0].getElementsByClassName('event-occurrence');
}

function createBar(position, start_day, end_day, color) {
  let bar = document.createElement('div');
  bar.classList = 'event-occurrence event-single no-select';
  bar.style.top = (20*position)+'%';
  Utilities.setBackgroundColor(bar, color);
  resizeBar(bar, start_day, end_day);
  bar._width = end_day-start_day+1; // docs: @set(bar._width)

  state.bar_list.push(bar);
  return bar;
}

/**
 * renders all bars for the current view of calendar as a function
 * of `state.view_day_data`. All bars are recreated from 0 and
 * their references are stored in `state.bar_list` to be deleted on the
 * next render call. As this funciton is called only once per modification, we
 * don't really care for now how expensive it may be.
 */
export function renderBars() {
  for (const bar of state.bar_list) {
    bar.remove();
  }
  state.bar_list.length = 0;
  
  if (state.is_instantiating) {
    const view_day_data = state.view_day_data;

    let start = 0;
    let end = 1;
    let region_type = view_day_data[0];
    for (; end < view_day_data.length; end++) {
      if (region_type !== view_day_data[end] || end % 7 === 0) {
        if (region_type !== NOT_AVAILABLE && (region_type === TAKEN || state.is_instantiating)) {
          const week_number = Math.floor(start / 7);
          const week = elements.weeks[week_number];
          const start_day = start % 7;
          let end_day = (end-1) % 7;

          let bar = createBar(0, start_day, end_day, getColor(region_type));
          bar._type = region_type;
          if (region_type == TAKEN) {
            const event_indetifier = state.instantiating_event_identifier;
            if (!event_indetifier) {
              console.error('unreachable');
            }
            const event_index = Global.data.events_map.get(event_indetifier);
            bar.textContent = Global.data.events_name[event_index];
          } else {
            bar.textContent = 'Disponible';
          }
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

  const diff = state.base_day_number - Global.data.base_day_number;
  const day_occurrences_start = Math.max(diff, 0);
  const day_occurrences_end   = Math.min(diff+DAY_COUNT, Global.data.day_occurrences.length);

  const day_view_start = Math.max(-diff, 0);
  const day_view_end   = Math.min(day_view_start+(day_occurrences_end-day_occurrences_start), DAY_COUNT);

  let day_occurrences_index = day_occurrences_start;
  let day_view_index = day_view_start;

  const tracked_events = {
    occurrence_identifiers: new Int32Slice(512),
    start_positions: new Int32Slice(512),
    free_list: new Int32Slice(32),
  };

  while (day_occurrences_index < day_occurrences_end && day_view_index < day_view_end) {
    const occurrences = Global.data.day_occurrences[day_occurrences_index];

    for(let tracked_event_index = 0;
        tracked_event_index < tracked_events.occurrence_identifiers.length;
        tracked_event_index++)
    {
      const occurrence_identifier = tracked_events.occurrence_identifiers.view[tracked_event_index];
      const start_view_pos = tracked_events.start_positions.view[tracked_event_index];
      if (occurrences.includes(occurrence_identifier) &&
         (day_occurrences_index !== day_occurrences_end-1 ||
           day_view_index !== day_view_end-1)) {
        continue;
      }
      if (day_occurrences_index === day_occurrences_end-1 ||
           day_view_index === day_view_end-1) {
        day_view_index++;
      }
      tracked_events.free_list.push(tracked_event_index);

      const week_number = Math.floor(start_view_pos/7);
      for (let level = 0; level < 5; level++) {
        let level_is_ok = true;
        for (let day = week_number*7; day < day_view_index; day++) {
          const day_occrs = elements.days[day].querySelectorAll('.event-occurrence');
          for (const occr of day_occrs) {
            if (day+occr._width >= start_view_pos) {
              level_is_ok = false;
              break;
            }
          }
          if (!level_is_ok) {
            break;
          }
        }
        if (level_is_ok) {
          // setting at correct level
          const bar = createBar(
            level,
            start_view_pos%7,
            (day_view_index-1)%7,
            palette.grey,
          );
          const occurrence_index = Global.data.occurrences_map.get(occurrence_identifier);
          const event_identifier = Global.data.occurrences_event_identifiers[occurrence_index];
          const event_index = Global.data.events_map.get(event_identifier);
          const event_name = Global.data.events_name[event_index];

          bar.textContent = event_name;
          elements.days[start_view_pos].getElementsByClassName('bar-holder')[0].append(bar);
          break;
        }
      }
    }

    tracked_events.occurrence_identifiers.shrink(tracked_events.free_list);
    tracked_events.start_positions.shrink(tracked_events.free_list);
    tracked_events.free_list.length = 0;

    for (const occurrence of occurrences) {
      if (tracked_events.occurrence_identifiers.includes(occurrence)) {
        continue;
      }
      tracked_events.occurrence_identifiers.push(occurrence);
      tracked_events.start_positions.push(day_view_index);
    }

    day_occurrences_index++;
    day_view_index++;
  }
}

function mergeIntervals() {
  const intervals = state.selection_intervals;
  intervals.sort((a, b) => a[0] - b[0]);
  let i = 0
  while (i < intervals.length-1) {
    if (intervals[i][1] >= intervals[i+1][0]-1) {
      intervals[i][1] = Math.max(intervals[i][1], intervals[i+1][1]);
      intervals.splice(i+1, 1);
    }
    i++;
  }
  console.log("intervals: ", state.selection_intervals);
}

Global.elements.calendar_body.addEventListener('mousemove', e => {
  if (!state.is_dragging) return;

  const d = 50;
  const week_shift = state.week._index*7; 
  const view_day_data = state.view_day_data;
  const intervals = state.selection_intervals;
  if ((state.start_x-e.clientX>d || state.start_x-e.clientX<-d)
    && !state.is_created) {
    
    const day_number = state.target.closest('.day-cell')._day_number;
    if (view_day_data[state.start_cell_num+week_shift] === AVAILABLE) {
      view_day_data[state.start_cell_num+week_shift] = TAKEN;
      state.selected_day_counter += 1;
      renderBars();
      intervals.push([day_number, day_number]); // correct
      mergeIntervals();
    }
    state.is_created = true;

  } else if (state.is_created) {
    const num = getCellNum(e.clientX);
    // we don't do anything, if user points to the same position
    if (num === state.prev_focus_num) {
      return;
    }

    let delete_start = Math.min(state.prev_focus_num, num)+week_shift;
    let delete_end = Math.max(state.prev_focus_num, num)+week_shift;
    let fill_start = Math.min(state.start_cell_num, num)+week_shift;
    let fill_end = Math.max(state.start_cell_num, num)+week_shift;

    let change_counter = 0;
    const undo_list = [];
    for (let i = delete_start; i <= delete_end; i++) {
      if (view_day_data[i] === TAKEN) {
        undo_list.push(i);
        view_day_data[i] = AVAILABLE;
        change_counter--;
      }
    }

    for (let i = fill_start; i <= fill_end; i++) {
      if (view_day_data[i] === AVAILABLE) {
        change_counter++;
      }
    }

    const duration = Global.getEventsDuration(state.instantiating_event_identifier);
    if (duration < state.selected_day_counter+change_counter) {
      for (const i of undo_list) {
        view_day_data[i] = TAKEN;
      }
      return;
    }

    for (let i = fill_start; i <= fill_end; i++) {
      if (view_day_data[i] === AVAILABLE) {
        view_day_data[i] = TAKEN;
      }
    }
    state.selected_day_counter += change_counter;

    const week_start = state.week.querySelector('.day-cell')._day_number;
    const week_end = week_start+6;

    const base_day = state.base_day_number;
    // deliting all weeks intervals

    eraseInterval(intervals, week_start, week_end);
    // setting new weeks intervals;
    let start = week_shift;
    let type = view_day_data[start];
    let end = week_shift + 1;

    for (; end < week_shift+7; end++) {
      if (view_day_data[end] != type) {
        if (type === TAKEN) {
          intervals.push([start+base_day, end-1+base_day]);
        }
        start = end;
        type = view_day_data[end];
      }
    }
    if (type === TAKEN) {
      intervals.push([start+base_day, end-1+base_day]);
    }
    mergeIntervals();

    state.prev_focus_num = num;
    renderBars();
  }
});
