import * as Global from './global.js';
import * as Utilities from './utilities.js';
import * as Api from './api.js';
import * as Io from './io.js';
import * as DM from './data_manager.js';
import { palette } from './color.js';

const Int32Slice = DM.Int32Slice;

// objects for common use
const pool_date = new Date();

// globals in calendar
const gc_track = document.getElementById('calendar-track');
const gc_calendar_content_1 = document.getElementById('calendar-content-1');
const gc_calendar_content_2 = document.getElementById('calendar-content-2');
const gc_weeks_1 = gc_calendar_content_1.querySelectorAll('.week-row');
const gc_weeks_2 = gc_calendar_content_2.querySelectorAll('.week-row');
const gc_days_1 = gc_calendar_content_1.querySelectorAll('.day-cell');
const gc_days_2 = gc_calendar_content_2.querySelectorAll('.day-cell');
let gc_current = {
  content: gc_calendar_content_1,
  weeks: gc_weeks_1,
  days: gc_days_1,
  bars: [],
  days_data: new Uint32Array(gc_weeks_1.length*7),
};
let gc_backing = {
  content: gc_calendar_content_2,
  weeks: gc_weeks_2,
  days: gc_days_2,
  bars: [],
  days_data: new Uint32Array(gc_weeks_1.length*7),
};

let gc_today_frame = gc_days_1[0];
let gc_base_day_number = 0;
let gc_target = null;
let gc_cells = null;
let gc_week = null;
let gc_start_cell_num = 0;
let gc_prev_focus_num = 0;
let gc_is_updating = false;
let gc_is_created = false;
let gc_is_dragging = false;
let gc_is_selected = false;
let gc_is_instantiating = false;
let gc_is_updating_focus = false;
let gc_is_animating = false;
let gc_start_x = 0;
let gc_focused_month = new Date(pool_date.getFullYear(), pool_date.getMonth());
let gc_selection_intervals = [];
let gc_top_month_week_observer = null;
let gc_bottom_month_week_observer = null;
let gc_calendar_resize_observer = null;
let gc_instantiating_event_identifier = undefined;
let gc_selected_day_counter = 0;
let gc_week_height = gc_weeks_1[0].getBoundingClientRect().height;
let gc_week_coordinates = [];

{
  const week = gc_weeks_1[0];
  for (let i = 0; i < 7; i++) {
    const rect = week.children[i].getBoundingClientRect();
    gc_week_coordinates[i] = {
      right: rect.right,
      left: rect.left,
    };
  }
}

export const WEEK_COUNT = gc_weeks_1.length;
const DAY_COUNT = WEEK_COUNT*7;
const MS_IN_DAY = 86400000;

const UP   =  1;
const DOWN = -1;

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


const monthDisplay = {
  names: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
  'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  month_holder: document.createElement('strong'),
  month_buffer: document.createElement('strong'),
  year_holder: document.createTextNode(""),
  year_buffer: document.createTextNode(""),
  
  set(date) {
    this.month_buffer.textContent = this.names[date.getMonth()];
    this.year_buffer.nodeValue = " " + date.getFullYear();
    Global.elements.month_display.replaceChildren(this.month_buffer, this.year_buffer);
    const month_holder = this.month_holder;
    this.month_holder = this.month_buffer;
    this.month_buffer = month_holder;
    const year_holder = this.year_holder;
    this.year_holder = this.year_buffer;
    this.year_buffer = year_holder;
  }
};

export function update(days) {
  const date = pool_date;
  date.setTime(Date.now());
  const today = Math.floor(date.getTime()/MS_IN_DAY);
  const focus_month = gc_focused_month.getMonth();
  monthDisplay.set(gc_focused_month);
  date.setTime(gc_base_day_number*MS_IN_DAY);
  gc_today_frame.classList.remove('today');
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    day.children[0].textContent = date.getDate();
    day._day_number = Math.floor(date.getTime() / MS_IN_DAY);
    if (date.getMonth() === focus_month) {
      day.classList.add('focused-month');
    } else {
      day.classList.remove('focused-month');
    }
    if (day._day_number == today) {
      day.classList.add('today');
      gc_today_frame = day;
    }
    date.setDate(date.getDate() + 1);
  }
}

export function init() {
  const calendar_body = Global.elements.calendar_body;
  gc_base_day_number = newBaseDate(gc_focused_month, pool_date);

  Global.elements.calendar_body.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (gc_is_animating) return;

    const threshold = 15;
    if (e.deltaY > threshold) {
      animateMonthTransition(DOWN);
    } else if (e.deltaY < -threshold) {
      animateMonthTransition(UP);
    }
  }, { passive: false });

  gc_calendar_resize_observer = new ResizeObserver(() => {
    const week = gc_current.weeks[0];
    for (let i = 0; i < 7; i++) {
      const rect = week.children[i].getBoundingClientRect();
      gc_week_coordinates[i].right = rect.right;
      gc_week_coordinates[i].left = rect.left;
    }
    gc_week_height = week.getBoundingClientRect().height;
    for (const bar of gc_current.bars) {
      resizeBar(bar, bar._start, bar._start + bar._width - 1);
    }
  });

  gc_calendar_resize_observer.observe(Global.elements.calendar_body);

  const weeks = gc_current.weeks;
  for (let i = 0; i < weeks.length; i++) {
    weeks[i]._index = i;
    const days = weeks[i].children;
    for (let j = 0; j < days.length; j++) {
      days[j]._index = j; // docs: @set(day-cell._index)
    }
  }
  update(gc_current.days);
}

function newBaseDate(focused, pool_date) {
  pool_date.setTime(focused.getTime());
  pool_date.setHours(0, 0, 0, 0);
  pool_date.setDate(pool_date.getDate() - (pool_date.getDay()+6)%7);
  const timezone_offset_ms = pool_date.getTimezoneOffset() * 60 * 1000;
  return Math.floor((pool_date.getTime()-timezone_offset_ms)/MS_IN_DAY);
}

function animateMonthTransition(direction) {
  if (gc_is_animating) return;
  gc_is_animating = true;

  if (direction === DOWN) {
    gc_focused_month.setMonth(gc_focused_month.getMonth()+1);
  } else {
    gc_focused_month.setMonth(gc_focused_month.getMonth()-1);
  }
  gc_base_day_number = newBaseDate(gc_focused_month, pool_date);
  update(gc_backing.days);
  renderBars(gc_backing);

  if (direction === DOWN) {
    gc_current.content.style.order = '1';
    gc_backing.content.style.order = '2';
  } else {
    gc_current.content.style.order = '2';
    gc_backing.content.style.order = '1';
  }

  gc_track.style.transition = 'none';
  gc_track.style.transform = `translateY(-${gc_current.content.offsetTop}px)`;
  gc_track.offsetHeight;

  gc_track.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  gc_track.style.transform = `translateY(-${gc_backing.content.offsetTop}px)`;

  gc_track.addEventListener('transitionend', () => {
    [gc_current, gc_backing] = [gc_backing, gc_current];
    setTimeout(() => { gc_is_animating = false; }, 10);
  }, { once: true });
}

export function startInstantiating(identifier) {
  gc_is_instantiating = true;
  gc_instantiating_event_identifier = identifier;
  gc_selected_day_counter = 0;
  gc_selection_intervals = [];
  renderBars(gc_current);
  document.addEventListener("keydown", saveSelectionsCallback);
}

function resizeBar(bar, start, end) {
  let new_width = gc_week_coordinates[end].right-
    gc_week_coordinates[start].left-1;
  bar.style.width = new_width+'px';
}

// runs a callback over all days in the displayed buffer
function iterateOverDays(dayCallback) { // @nocheckin
  const rows = Global.elements.calendar_content.children;
  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    for (let j = 0; j < row.children.length; j++) {
      dayCallback(row.children[j]);
    }
  }
}

export function highlightEvent(event_id) {
  for (const bar of gc_current.bars) {
    const event_identifier = Global.getOccurrencesEvent(bar._data_identifier);
    if (event_identifier === event_id) {
      Utilities.setBackgroundColor(bar, palette.blue);
    } else {
      Utilities.setBackgroundColor(bar, palette.base1);
    }
  }
}

export function grayoutOccurrences() {
  for (const bar of gc_current.bars) {
    Utilities.setBackgroundColor(bar, palette.base1);
  }
}

// @nocheckin: We should actually try to rerender the view and swap only
// when it is done and be at the correct scrollTop offset. Because that
// generation of dom can take a bit of time.

function getCellNum(pos_x) {
  const week_rect = gc_week.getBoundingClientRect(); 
  const rel_pos_x = pos_x-week_rect.left;
  return Math.floor(rel_pos_x/(week_rect.width/7.0));
}

Global.elements.calendar_body.addEventListener('mousedown', e => {
  if (e.button !== 0 || !gc_is_instantiating) return;

  // handle highlighting
  let new_bar = e.target.closest('.event-occurrence');
  if (gc_is_selected) {
    let old_bar = gc_target.closest('.event-occurrence');
    if (new_bar !== old_bar) {
      gc_target.closest('.event-occurrence').classList.remove('highlight-border');
      gc_is_selected = false;
      document.removeEventListener("keydown", deleteSelectedElement);
    }
  }

  gc_is_dragging = true;
  gc_start_x = e.clientX;
  gc_target = e.target;

  gc_week = e.target.closest('.week-row');
  gc_cells = gc_week.getElementsByClassName('day-cell');

  const clicked_cell_num = getCellNum(e.clientX);

  if (new_bar && new_bar._type === TAKEN) {
    const rect = new_bar.getBoundingClientRect();
    gc_is_created = true;
    if (rect.right - e.clientX < e.clientX - rect.left) { // dragging right end
      gc_start_cell_num = new_bar.closest('.day-cell')._index;
      gc_prev_focus_num = gc_start_cell_num + new_bar._width-1;
    } else { // dragging left end
      gc_prev_focus_num = new_bar.closest('.day-cell')._index;
      gc_start_cell_num = gc_prev_focus_num + new_bar._width-1;
    }
  } else {
    const duration = Global.getEventsDuration(gc_instantiating_event_identifier);
    if (duration <= gc_selected_day_counter) {
      gc_is_dragging = false;
      return;
    }
    gc_start_cell_num = clicked_cell_num;
    gc_prev_focus_num = gc_start_cell_num;
  }
});

Global.elements.calendar_body.addEventListener('mouseup', e => {
  let bar = null; // @note: there may be a bug in gc_is_created check down bellow
  if (!gc_is_created &&
    !gc_is_instantiating &&
    gc_target &&
    (bar = gc_target.closest('.event-occurrence')) &&
    bar._type === TAKEN
  ) {
    bar.classList.toggle('highlight-border');
    if (gc_is_selected ^= true) {
      document.addEventListener("keydown", deleteSelectedElement);
    } else {
      document.removeEventListener("keydown", deleteSelectedElement);
    }
  }

  gc_is_created = false;
  gc_is_dragging = false;
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
    const bar = gc_target.closest('.event-occurrence');
    const day = bar.closest('.day-cell');
    const day_number = day._day_number;
    const week = day.closest('.week-row');
    const week_shift = week._index*7;
    const start = day._index+week_shift;
    const end = start+bar._width-1;
    for (let i = start; i <= end; i++) {
      gc_current.days_date[i]=AVAILABLE;
    }
    gc_selected_day_counter -= bar._width;
    const intervals = gc_selection_intervals;
    eraseInterval(intervals, day_number, day_number+bar._width-1);
    renderBars(gc_current);
  }
}

/**
 @param {Event} e
*/
function saveSelectionsCallback(e) {
  if (e.key === "Enter") {
    gc_is_instantiating = false;
    document.removeEventListener("keydown", saveSelectionsCallback);
    renderBars(gc_current);
    const event_identifier = gc_instantiating_event_identifier; 
    const intervals = gc_selection_intervals;
    const writer = Api.createBufferWriter(Api.CREATE, Api.OCCURRENCES_MAP);
    Io.writeInt32(writer, event_identifier);
    Io.writeArrayOfInt32Pairs(writer, intervals);

    Api.request(writer).then(response => {
      Utilities.throwIfNotOk(response);
      response.arrayBuffer().then(binary => {
        const reader     = new Io.BufferReader(binary);
        const identifier = Io.readInt32(reader);
        const free_list  = Global.data.occurrences_free_list;
        const map        = Global.data.occurrences_map;
        const index      = DM.storageIndex(map, free_list);

        map.set(identifier, index);
        Global.data.occurrences_venue[index]             = -1;
        Global.data.occurrences_event_identifiers[index] = event_identifier;
        Global.data.occurrences_dates[index]             = intervals;
        Global.data.occurrences_participants[index]      = [];

        const day_occurrences = Global.data.day_occurrences;
        if (day_occurrences.length === 0) {
          Global.data.base_day_number = intervals[0][0];
        }
        const base_day     = Global.data.base_day_number;
        const last_idx     = intervals.length - 1;
        const end_day      = base_day + day_occurrences.length - 1;
        const prefix_diff  = Math.max(base_day - intervals[0][0], 0);
        const postfix_diff = Math.max(intervals[last_idx][1] - end_day, 0);
        const old_len      = day_occurrences.length;
        const diff         = prefix_diff+postfix_diff;
        const new_len      = old_len+diff;
        
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

        gc_current.days_data.fill(0);
        renderBars(gc_current);
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
  bar.classList = 'event-occurrence no-select';
  bar.style.top = (20*position)+'%';
  Utilities.setBackgroundColor(bar, color);
  bar._width = end_day-start_day+1; // docs: @set(bar._width)
  bar._level = position;
  bar._start = start_day;
  resizeBar(bar, start_day, end_day);

  return bar;
}

/**
 * renders all bars for the current view of calendar as a function
 * of `.days_data`. All bars are recreated from 0 and
 * their references are stored in `.bars` to be deleted on the
 * next render call. As this funciton is called only once per modification, we
 * don't really care for now how expensive it may be.
 */
export function renderBars(target = gc_current) {
  for (const bar of target.bars) {
    bar.remove();
  }
  target.bars.length = 0;
  
  if (gc_is_instantiating) {
    const view_day_data = target.days_data;

    let start = 0;
    let end = 1;
    let region_type = view_day_data[0];
    for (; end < view_day_data.length; end++) {
      if (region_type !== view_day_data[end] || end % 7 === 0) {
        if (region_type !== NOT_AVAILABLE && (region_type === TAKEN || gc_is_instantiating)) {
          const week_number = Math.floor(start / 7);
          const week = target.weeks[week_number];
          const start_day = start % 7;
          let end_day = (end-1) % 7;

          let bar = createBar(0, start_day, end_day, getColor(region_type));
          target.bars.push(bar);
          bar._type = region_type;
          if (region_type == TAKEN) {
            const event_indetifier = gc_instantiating_event_identifier;
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

  const diff = gc_base_day_number - Global.data.base_day_number;
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
          const day_occrs = target.days[day].querySelectorAll('.event-occurrence');
          for (const occr of day_occrs) {
            if (occr._level === level && day+occr._width > start_view_pos) {
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
            palette.base1,
          );
          target.bars.push(bar);
          const occurrence_index = Global.data.occurrences_map.get(occurrence_identifier);
          const event_identifier = Global.data.occurrences_event_identifiers[occurrence_index];
          const event_index = Global.data.events_map.get(event_identifier);
          const event_name = Global.data.events_name[event_index];

          const span_name = document.createElement('span');
          const span_id   = document.createElement('span');
          span_name.classList = "event-title";
          span_id.classList   = "event-id";
          span_name.textContent = event_name;
          span_id.textContent   = "#"+occurrence_identifier;

          bar.replaceChildren(span_name, span_id);
          bar._data_identifier = occurrence_identifier;
          target.days[start_view_pos].getElementsByClassName('bar-holder')[0].append(bar);
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
  const intervals = gc_selection_intervals;
  intervals.sort((a, b) => a[0] - b[0]);
  let i = 0
  while (i < intervals.length-1) {
    if (intervals[i][1] >= intervals[i+1][0]-1) {
      intervals[i][1] = Math.max(intervals[i][1], intervals[i+1][1]);
      intervals.splice(i+1, 1);
    }
    i++;
  }
}

Global.elements.calendar_body.addEventListener('mousemove', e => {
  if (!gc_is_dragging) return;

  const d = 50;
  const week_shift = gc_week._index*7; 
  const view_day_data = gc_current.days_data;
  const intervals = gc_selection_intervals;
  if ((gc_start_x-e.clientX>d || gc_start_x-e.clientX<-d)
    && !gc_is_created) {
    
    const day_number = gc_target.closest('.day-cell')._day_number;
    if (view_day_data[gc_start_cell_num+week_shift] === AVAILABLE) {
      view_day_data[gc_start_cell_num+week_shift] = TAKEN;
      gc_selected_day_counter += 1;
      renderBars(gc_current);
      intervals.push([day_number, day_number]); // correct
      mergeIntervals();
    }
    gc_is_created = true;

  } else if (gc_is_created) {
    const num = getCellNum(e.clientX);
    // we don't do anything, if user points to the same position
    if (num === gc_prev_focus_num) {
      return;
    }

    let delete_start = Math.min(gc_prev_focus_num, num)+week_shift;
    let delete_end = Math.max(gc_prev_focus_num, num)+week_shift;
    let fill_start = Math.min(gc_start_cell_num, num)+week_shift;
    let fill_end = Math.max(gc_start_cell_num, num)+week_shift;

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

    const duration = Global.getEventsDuration(gc_instantiating_event_identifier);
    if (duration < gc_selected_day_counter+change_counter) {
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
    gc_selected_day_counter += change_counter;

    const week_start = gc_week.querySelector('.day-cell')._day_number;
    const week_end = week_start+6;

    const base_day = gc_base_day_number;
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

    gc_prev_focus_num = num;
    renderBars(gc_current);
  }
});
