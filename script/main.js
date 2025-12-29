import {
  setMonthScrollPosition,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} from './scrollable_calendar.js';

import { palette } from './color.js';
import { BufferReader, BufferWriter } from './io.js';
import { DataManager } from './data_manager.js';
import { numInput } from './num_input.js';
import * as SearchDisplay from './search_display.js';
import {} from './context_menu.js';
import { callbacks } from './global_state.js';
import { token } from './login_main.js'

const MS_IN_DAY = 86400000;

const data = new DataManager();
window.data = data;

let state = {
  sideMenuIsOpen: false,
  viewSelection: 0,
  datasetSelection: 0,
  eventsSelection: -1,
  staffSelection: -1,
  venueSelection: -1,
  focusedElement: null,
  baseDayNumber: 0,
  isUpdating: false,
  token: null,
};

export function initApp() {
  document.body.className = "";
  state.token = token;
}

let elms = {
  calendarBody: null,
  calendarContent: null,
  markerBlocks: null,
  monthDisplay: null,
  rightClickMenu: null,
  sideMenu: document.createElement('div'),
  bodyContainer: null,
  sideMenuContainer: null,
  todayFrame: null,
  dataListContainer: null,

  view: [null, null],
  scope: [document.createElement('div'), document.createElement('div'), document.createElement('div')],
}
window.elms = elms;

const zonesId = {
  DATATYPE: 0,
  VIEWTYPE: 1,
  EVENTLIST: 2,
  STAFFLIST: 3,
  VENUELIST: 4,
};

const viewId = {
  CALENDER: 0,
  INFORMATION: 1,
};

const scopeId = {
  EVENT: 0,
  STAFF: 1,
  VENUE: 2,
};

// eList is the list of buttons, that way we have a direct access to it
let zones = [
  { selection: 0, eList: null },
  { selection: 0, eList: null },
  { selection: -1, eList: elms.scope[scopeId.EVENT].children },
  { selection: -1, eList: elms.scope[scopeId.STAFF].children },
  { selection: -1, eList: elms.scope[scopeId.VENUE].children },
];

let tmpls = [ document.createElement('div'), null, null, null ];

function createStaffTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');

  const columnWidth = 125;
  const list = ["Participants", "Formateur", "Responsable Pedagogique", "Assistant"];

  table.innerHTML = `
    <h3 class="txt-center">Nomber de</h3>

    <div class="h-container with-width">
    </div>

    <div class="m-box v-container with-width">main
    <div id="event-staff-number-map" class="v-container scrollable-box disp-flex grow scroll-smooth bordered">
    </div>
    </div>
    `;
  
  function createLocalHeader(name) {
    let retval = document.createElement('div');
    retval.className = 'disp-flex grow half-wide justify-content-center';
    let header = document.createElement('h4');
    header.className = 'txt-center';
    header.textContent = name;
    retval.append(header);
    return retval;
  }

  let container = table.children[1];
  container.style.setProperty('--width', (columnWidth*(list.length+1)) + 'px');
  for (let name of list) {
    container.append(createLocalHeader(name));
  }

  container = table.children[2];
  container.style.setProperty('--width', (columnWidth*(list.length+1)) + 'px');
  
  return table;
}

function createCompetencesTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  table.innerHTML = `
    <div class="v-container align-items-center">
    <h3 class="txt-center">Competences de</h3>

    <div class="js-set h-container align-items-center">
    </div>
    `;

  const container = table.querySelector('.js-set');

  // const baseWidth = 125; 
  for (let name of data.rolesName) {
    container.append(SearchDisplay.create(name, data.rolesName, 'Nouvelle Compétence'));
  }

  return table;
}

function createFooterOptions() {
  let footer = document.createElement('div');
  footer.className = 'h-container';
  footer.innerHTML = `
    <div class="row-selection">
    Durée: <button id="event-duration" class="hover std-min no-padding txt-center tiny-button">\u00A0</button>d
    </div>
    `;
  return footer;
}

{
  tmpls[scopeId.EVENT].innerHTML = `
    <div class="v-container">
    </div>
  `;
  tmpls[scopeId.EVENT].children[0].append(
    SearchDisplay.create('Personel', data.rolesName, 'Nouveau Rôle'),
    createStaffTable(),
    createCompetencesTable(),
    createFooterOptions(),
  );
}

function createTemplateLine() {
  let line = document.createElement('div');
  line.className = 'h-container align-items-center wide';
  line.innerHTML = tmplHTML
  return line;
}

function resetEventInfoView() { // @working
  // scoped functions
  const tmplHTML = `
    <div class="disp-flex grow half-wide justify-content-center bottom-right-border">
    <div class="with-padding">de <button class="std-min hover no-padding txt-center tiny-button"></button> à <button class="std-min hover no-padding txt-center tiny-button"></button></div>
    </div>
    <div class="disp-flex grow half-wide bottom-border">
    <div class="with-padding"><button class="hover std-min no-padding txt-center tiny-button"> </button></div>
    </div>
    `;

  function createTemplateLine() {
    let line = document.createElement('div');
    line.className = 'h-container align-items-center wide';
    line.innerHTML = tmplHTML
    return line;
  }

  function addEmptyLine(parent) {
    let line = createTemplateLine();
    const btns = line.querySelectorAll('button');
    const btnsCallbacks = [];
    function endOfWriting(b) {
      b.textContent = numInput.elm.value || '\u00A0';
      numInput.elm.replaceWith(b);

      let dataIsSet = true;
      for (let _b of btns) {
        if (_b.textContent == '\u00A0') {
          dataIsSet = false;
          break;
        }
      };
      if (dataIsSet) {
        line.classList.add('deletable');
        let dataArray = data.eventPersonalNumMap[zones[zonesId.EVENTLIST].selection];
        line._dIdx = dataArray.length/3;
        for (let j = 0; j < btns.length; j++) {
          btns[j]._dIdx = dataArray.length;
          dataArray.push(Number(btns[j].textContent));
          btns[j].classList.add('editable');
          btns[j].removeEventListener('click', btnsCallbacks[j]);
        }
        addEmptyLine(parent);
      }
    }
    btns.forEach(b => {
      b.textContent = '\u00A0'; // '\u00A0' is an empty space with non zero size
      b.className = 'std-min hover no-padding txt-center tiny-button';

      function localCallback() {
        b.replaceWith(numInput.elm);
        numInput.elm.focus();
        numInput.endOfWriting = () => { endOfWriting(b) };
      }
      btnsCallbacks.push(localCallback);
      b.addEventListener('click', localCallback);
    });

    parent.appendChild(line);
  }

  // actual function code
  const zone = zones[zonesId.EVENTLIST];
  if (zone.selection == -1) { // we need to show general setting
    return;
  }
  const event_id = zone.eList[zone.selection]._dIdx;
  let list = document.getElementById('event-staff-number-map');
  list.innerHTML = '';

  const _eventId = zones[zonesId.EVENTLIST].selection;

  let dataArray = data.eventPersonalNumMap[_eventId];
  if (dataArray === undefined) {
    dataArray = [];
    data.eventPersonalNumMap[_eventId] = [];
  }
  for (let i = 0; i < dataArray.length;) {
    let line = createTemplateLine();
    line._dIdx = Math.floor(i/3);
    const btns = line.querySelectorAll('button');
    for (let j = 0; j < btns.length; j++) {
      let b = btns[j];
      b._dIdx = i;
      b.textContent = dataArray[i++];
    };
    list.appendChild(line);
  }
  addEmptyLine(list);

  let duration = data.eventDuration[_eventId];
  if (duration === undefined) {
    data.eventDuration[_eventId] = -1;
    duration = -1;
  }

  let b = document.getElementById('event-duration');
  if (duration === -1) {
    b.textContent = '\u00A0';

    function localCallback() {
      b.replaceWith(numInput.elm);
      numInput.elm.focus();
      numInput.endOfWriting = () => { endOfWriting() };
    }
    function endOfWriting() {
      numInput.elm.replaceWith(b);
      const _eventId = zones[zonesId.EVENTLIST].selection;
      if (numInput.elm.value === '') {
        data.eventDuration[_eventId] = -1;
        return;
      }
      b.textContent = numInput.elm.value;
      data.eventDuration[_eventId] = Number(numInput.elm.value);
      b.classList.add('editable');
      b.removeEventListener('click', localCallback);
    }
    b.addEventListener('click', localCallback);
  } else {
    b.textContent = duration;
    b.classList.add('editable');
  }
}

{
  elms.sideMenu.classList.add('v-container');
  elms.sideMenu.id = 'side-menu';
  let hContainer = document.createElement('div');
  hContainer.className = 'header-container';
  let bContainer = document.createElement('div');
  bContainer.className = 'button-container';
  bContainer.id = 'data-type';
  let lContainer = document.createElement('div');
  zones[0].eList = bContainer.children;
  lContainer.id = 'button-container';
  lContainer.className = 'v-container grow';
  elms.scope[scopeId.EVENT].className = 'extendable v-container grow';
  elms.scope[scopeId.STAFF].className = 'extendable v-container grow';
  elms.scope[scopeId.VENUE].className = 'extendable v-container grow';
  let localCreateButton = () => {
    let b = document.createElement('button');
    b.className = 'event-button dynamic_bg';
    b.addEventListener('click', function (){
      handleClickOnListButton(b, zonesId.STAFFLIST);
    });
    return b;
  }
  elms.scope[scopeId.EVENT]._createButton = localCreateButton;
  elms.scope[scopeId.STAFF]._createButton = localCreateButton;
  elms.scope[scopeId.VENUE]._createButton = localCreateButton;

  elms.scope[scopeId.EVENT]._btnPlaceholder = 'Nouvel Événement';
  elms.scope[scopeId.STAFF]._btnPlaceholder = 'Nouveau Membre du Personnel';
  elms.scope[scopeId.VENUE]._btnPlaceholder = 'Nouveau Lieu';

  hContainer.append(bContainer);
  elms.dataListContainer = lContainer;

  let b1 = document.createElement('button');
  b1.addEventListener('click', () => {
    elms.dataListContainer.replaceChildren(elms.scope[scopeId.EVENT]); 
    handleClickOnViewButton(b1, zonesId.DATATYPE);
  });
  b1.textContent = 'Événements';
  b1._bIdx = 0;
  let b2 = document.createElement('button');
  b2.addEventListener('click', () => {
    elms.dataListContainer.replaceChildren(elms.scope[scopeId.STAFF]);
    handleClickOnViewButton(b2, zonesId.DATATYPE);
  });
  b2.textContent = 'Personnel';
  b2._bIdx = 1;
  let b3 = document.createElement('button');
  b3.addEventListener('click', () => {
    elms.dataListContainer.replaceChildren(elms.scope[scopeId.VENUE]);
    handleClickOnViewButton(b3, zonesId.DATATYPE);
  });
  b3.textContent = 'Lieux';
  b3._bIdx = 2;
  bContainer.append(b1, b2, b3);

  elms.sideMenu.replaceChildren(hContainer, elms.dataListContainer);
  elms.dataListContainer.appendChild(elms.scope[scopeId.EVENT]);
}

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
elms.sideMenuContainer = document.getElementById('side-menu-container');
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
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      resp.arrayBuffer().then(
        bin => {
          const r = new BufferReader(bin);
          data.read(r)
          for (let i = 0; i < data.eventsName.length; i++) { // @nocheckin: factor out
            const name = data.eventsName[i];
            let button = document.createElement('button');
            button.className = 'event-button dynamic_bg';
            button.addEventListener('click', function (){
              handleClickOnListButton(button, zonesId.EVENTLIST);
              if (zones[zonesId.EVENTLIST].selection >= 0 &&
                zones[zonesId.VIEWTYPE].selection === viewId.INFORMATION) {
                resetEventInfoView();
              }
            });
            elms.scope[scopeId.EVENT].appendChild(button);
            button.textContent = name;
            button._bIdx = i;
            button._dIdx = i;
          }
          for (let i = 0; i < data.usersName.length; i++) {
            const name = data.usersName[i];
            let button = document.createElement('button');
            button.className = 'event-button dynamic_bg';
            button.addEventListener('click', function (){
              handleClickOnListButton(button, zonesId.STAFFLIST);
            });
            elms.scope[scopeId.STAFF].appendChild(button);
            button.textContent = name;
            button._bIdx = i;
            button._dIdx = i;
          }
          for (let i = 0; i < data.venuesName.length; i++) {
            const name = data.venuesName[i];
            let button = document.createElement('button');
            button.className = 'event-button dynamic_bg';
            button.addEventListener('click', function (){

            });
            elms.scope[scopeId.VENUE].appendChild(button);
            button.textContent = name;
            button._bIdx = i;
            button._dIdx = i;
          }
        });
    })
    .catch(e => {
      console.error('Could not fetch data:', e);
    });
}

{
  let viewType = document.getElementById('view-type');
  let b1 = document.createElement('button');
  b1.textContent = 'Calendrier';
  b1.addEventListener('click' ,()=>{
    zones[zonesId.VIEWTYPE].selection = viewId.CALENDAR;
    elms.bodyContainer.replaceChild(elms.view[viewId.CALENDER], elms.bodyContainer.children[1]);
  });
  let b2 = document.createElement('button');
  b2.textContent = 'Information';

  b2.addEventListener('click' ,()=>{ 
    elms.view[viewId.INFORMATION].replaceChildren(tmpls[scopeId.EVENT]);
    elms.bodyContainer.replaceChild(elms.view[viewId.INFORMATION], elms.bodyContainer.children[1]);
    zones[zonesId.VIEWTYPE].selection = viewId.INFORMATION;
    if (zones[zonesId.DATATYPE].selection === scopeId.EVENT) {
      resetEventInfoView();
    }
  });
  viewType.append(b1,b2);
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
      console.log('we are hitting');
      const week = elms.calendarContent.querySelectorAll('.week-row')[0];
      elms.calendarBody.classList.replace('scroll-smooth', 'scroll-auto');
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

document.getElementById('side-menu-button').addEventListener('click', 
  function(button) {
    let sideMenuContainer = elms.sideMenuContainer;
    if (state.sideMenuIsOpen) {
      sideMenuContainer.removeChild(elms.sideMenu);
    } else {
      sideMenuContainer.appendChild(elms.sideMenu);
    }
    state.sideMenuIsOpen ^= true;
  }
);

function handleClickOnListButton(b, zn) {
  const z = zones[zn];
  if (z.selection == b._bIdx) {
    b.style.setProperty('--bg-color', 'transparent');
    z.selection = -1;
    return;
  }
  b.style.setProperty('--bg-color', palette.blue);
  if (z.selection >= 0) {
    z.eList[z.selection].style.setProperty('--bg-color', 'transparent');
  }
  z.selection = b._bIdx;
}

function handleClickOnViewButton(b, zn) {
  const z = zones[zn];
  z.selection = b._bIdx;
}
