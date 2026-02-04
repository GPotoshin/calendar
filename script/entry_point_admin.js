import {
  setMonthScrollPosition,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} from './scrollable_calendar.js';

import * as Api from './api.js';
import * as EventInfo from './event_info.js';
import * as Utils from './utils.js';
import { palette } from './color.js';
import { BufferReader, BufferWriter } from './io.js';
import * as DM from './data_manager.js';
import { numeric_input } from './num_input.js';
import {} from './context_menu.js'; // we need it
import {
  callbacks,
  elms,
  zonesId,
  viewId,
  scopeId,
  zones,
  data,
  tmpls,
} from './global_state.js';
import { token } from './login.js';
import { composeList, composeUsersList } from './side_menu.js';

const MS_IN_DAY = 86400000;

let state = {
  viewSelection: 0,
  datasetSelection: 0,
  eventsSelection: -1,
  staffSelection: -1,
  venueSelection: -1,
  focusedElement: null,
  baseDayNumber: 0,
  isUpdating: false,
  scrollPosSave: 0,
};

{
  elms.view[viewId.INFORMATION] = document.createElement('div');
  elms.view[viewId.INFORMATION].classList.add('view-content');
  elms.view[viewId.INFORMATION].classList.add('v-container');
  elms.view[viewId.INFORMATION].classList.add('align-items-center');
}

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

function setMonthDisplay(date) {
  let monthHolder = document.createElement('strong');
  monthHolder.textContent = months[date.getMonth()];
  let year = document.createTextNode(" " + date.getFullYear());
  elms.monthDisplay.replaceChildren(monthHolder, year);
}

let observers = {
  topMonthWeek: null,
  bottumMonthWeek: null,
  calendarScrolling: null,
};

let focus = {
  date: null,
};

function setUiList(ui, list) {
  for (let i = 0; i < list.length; i++) {
    var button = document.createElement('button');
    button.addEventListener('click', () => {
      this.classList.toggle('clicked');
    });

    button.className = 'hover';
    button.textContent = list[i];
    button._idx = i;
    ui.appendChild(button);
  }
}

function iterateOverDays(dayCallback) {
  const list = elms.calendarContent.children;
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
  date.setTime(Number(elms.calendarContent.children[0].children[0]._dayNum)*MS_IN_DAY)
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
  observers.topWeek.disconnect();
  observers.bottomWeek.disconnect();
  const weeks = elms.calendarContent.children;
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

elms.bodyContainer = document.getElementById('body-container');
elms.markerBlocks = document.getElementsByClassName('block-marker');
elms.calendarBody = document.getElementById('calendar-body');
elms.calendarContent = document.getElementById('calendar-content');
elms.monthDisplay = document.getElementById('month-display');
elms.rightClickMenu = document.getElementById('right-click-menu');
elms.view[viewId.CALENDER] = document.getElementsByClassName('view-content')[0];

zones[1].eList = document.getElementById("view-type").children;

setMonthScrollPosition();
const calendarBody = document.getElementById('calendar-body');
calendarBody.addEventListener('mousedown', handleMouseDown);
calendarBody.addEventListener('mouseup', handleMouseUp);
calendarBody.addEventListener('mousemove', handleMouseMove);

{
  const writer = new BufferWriter();
  writer.writeHash(token);

  fetch("/data", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  })
    .then(resp => {
      Utils.throwIfNotOk(resp);
      resp.arrayBuffer().then(
        bin => {
          const r = new BufferReader(bin);
          data.read(r)
          composeList(data.eventsId, data.eventsName, scopeId.EVENT, zonesId.EVENTLIST);
          composeUsersList();
          composeList(data.venuesId, data.venuesName, scopeId.VENUE, zonesId.VENUELIST);
          EventInfo.loadTemplate();
        });
    })
    .catch(e => {
      console.error('Could not fetch data:', e);
    });
}

{
  let viewType = document.getElementById('view-type');
  let b1 = document.createElement('button');
  let b2 = document.createElement('button');
  b1.textContent = 'Calendrier';
  b1._dataId = viewId.CALENDAR;
  b1.addEventListener('click' ,()=>{
    elms.bodyContainer.replaceChild(elms.view[viewId.CALENDER], elms.bodyContainer.children[1]);
    if (zones[zonesId.VIEWTYPE].selection === b2) {
      // probably we don't need to swap styles, if we do it before rendering
      elms.calendarBody.classList.replace('scroll-smooth', 'scroll-auto');
      elms.calendarBody.scrollTop = state.scrollPosSave;
      elms.calendarBody.classList.replace('scroll-auto', 'scroll-smooth');
    }
    zones[zonesId.VIEWTYPE].selection = b1;
  });
  b2.textContent = 'Information';
  b2._dataId = viewId.INFORMATION;
  b2.addEventListener('click' ,()=>{ // @nocheckin: we have a bug here
    if (zones[zonesId.VIEWTYPE].selection === b1) {
      state.scrollPosSave = elms.calendarBody.scrollTop;
      elms.bodyContainer.replaceChild(elms.view[viewId.INFORMATION], elms.bodyContainer.children[1]);
      zones[zonesId.VIEWTYPE].selection = b2;
      if (zones[zonesId.DATATYPE].selection._dataId === scopeId.EVENT) {
        EventInfo.update(); // in that function we are searching for an element
        // in the dom, but we are adding them just bellow
        elms.view[viewId.INFORMATION].replaceChildren(tmpls[scopeId.EVENT]);
      }
    }
  });
  viewType.append(b1,b2);
  zones[zonesId.VIEWTYPE].selection = b1;
}

observers.topWeek = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      focus.date.setMonth(focus.date.getMonth()-1);
      refocusMonth();
      setMonthObserver();
    }
  });
}, {
  root: calendarBody,
  threshold: [1],
  rootMargin: '-66% 0px 0px 0px'
});
observers.bottomWeek = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      focus.date.setMonth(focus.date.getMonth()+1);
      refocusMonth();
      setMonthObserver();
    }
  });
}, {
  root: calendarBody,
  threshold: [1],
  rootMargin: '0px 0px -66% 0px'
});
observers.calendarScrolling = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      if (state.isUpdating) return;
      state.isUpdating = true;
      elms.todayFrame.classList.remove('today');
      const SHIFTING_BY = 5;
      let shiftingBy = SHIFTING_BY;
      if (entry.target === elms.markerBlocks[0]) {
        shiftingBy = -SHIFTING_BY;
      }
      const week = elms.calendarContent.querySelectorAll('.week-row')[0];
      elms.calendarBody.classList.replace('scroll-smooth', 'scroll-auto');
      // @nocheckin: We should scroll by a variable offset determined after
      // dom content modification.
      elms.calendarBody.scrollTop -= shiftingBy*week.offsetHeight;
      elms.calendarBody.classList.replace('scroll-auto', 'scroll-smooth');
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
            elms.todayFrame = day;
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
  root: calendarBody,
});
observers.calendarScrolling.observe(elms.markerBlocks[0]);
observers.calendarScrolling.observe(elms.markerBlocks[1]);

let date = new Date();
focus.date = new Date();
const today_epoch = Math.floor(date.getTime() / MS_IN_DAY);
const today_weekday = (date.getDay()+6)%7;
elms.todayFrame = elms.calendarContent.children[8].children[today_weekday];
elms.todayFrame.classList.add('today');

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

const weekRows = document.querySelectorAll('.week-row');

function switchToCalendarView() {
  elms.bodyContainer.replaceChild(elms.view[viewId.CALENDER], elms.bodyContainer.children[1]);
}

function switchToInformationView() {
  elms.bodyContainer.replaceChild(elms.view[viewId.INFORMATION], elms.bodyContainer.children[1]);
}
