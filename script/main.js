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

const MS_IN_DAY = 86400000;

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
};

let callbacks = {
  handleTyping: {func: null, obj: null},
  showInfo: {func: null, obj: null},
}

let elms = {
  calendarBody: null,
  calendarContent: null,
  createOptionMenu: null,
  markerBlocks: null,
  monthDisplay: null,
  nameList: null,
  rightClickMenu: null,
  sideMenu: document.createElement('div'),
  bodyContainer: null,
  sideMenuContainer: null,
  venueList: null,
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

function createSearchMenuButton(name) {
  let b = document.createElement('button');
  b.classList.add('hover', 'snap-start');
  b.textContent = name;
  return b;
}

function createSearchMenu(name) {
  let menu = document.createElement('div');
  let name_list = ["Formateur", "Responsable Pedagogique", "Assistant"];
  let itemElements = new Map();

  menu.classList.add('m-box', 'v-container');
  menu.innerHTML = `
    <h4 class="js-set txt-center">Personnel</h4>
    <div class="h-container">
    <div class="searching-field h-container disp-flex grow half-wide"><div class="arrow">></div><input class="searching-input" type="text" placeholder="Trouver"></input></div>
    </div>
    <div class="h-container grow">
    <div id="event-attendee-diplomes" class="js-set text-box v-container scrollable-box scroll bordered grow half-wide">
    </div>
    </div>
    `;
  const objList = menu.querySelectorAll('.js-set');
  const searchInput = menu.querySelector('.searching-input');
  objList[0].textContent = name;
  const container = objList[1];

  // Create and store all buttons
  for (const n of name_list) {
    const btn = createSearchMenuButton(n);
    itemElements.set(n, btn);
    container.append(btn);
  }
  
  function fuzzyMatch(pattern, text) {
    pattern = pattern.toLowerCase();
    text = text.toLowerCase();
    let patternIdx = 0;
    let textIdx = 0;
    let score = 0;
    let consecutiveMatches = 0;
    const matches = [];
    while (patternIdx < pattern.length && textIdx < text.length) {
      if (pattern[patternIdx] === text[textIdx]) {
        matches.push(textIdx);
        if (patternIdx > 0 && matches[patternIdx - 1] === textIdx - 1) {
          consecutiveMatches++;
          score += 5 + consecutiveMatches;
        } else {
          consecutiveMatches = 0;
          score += 1;
        }
        if (textIdx === 0 || text[textIdx - 1] === ' ') {
          score += 10;
        }
        if (text[textIdx] === text[textIdx].toUpperCase() && text[textIdx] !== ' ') {
          score += 5;
        }
        patternIdx++;
      }
      textIdx++;
    }
    if (patternIdx !== pattern.length) {
      return null;
    }
    score -= (text.length - pattern.length) * 0.5;
    return score;
  }
  
  function updateList() {
    const query = searchInput.value;
    if (!query) {
      container.innerHTML = '';
      for (const n of name_list) {
        container.append(itemElements.get(n));
      }
      return;
    }
    const scored = [];
    for (const n of name_list) {
      const score = fuzzyMatch(query, n);
      if (score !== null) {
        scored.push({ name: n, score: score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    container.innerHTML = '';
    for (const item of scored) {
      container.append(itemElements.get(item.name));
    }
  }
  searchInput.addEventListener('input', updateList);

  return menu;
}

function createStaffTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  table.innerHTML = `
    <h3 class="txt-center">Nomber de</h3>

    <div class="h-container align-items-center wide m-width">
      <div class="disp-flex grow half-wide justify-content-center">
      <h4 class="txt-center">Participants</h4>
      </div>
      <div class="disp-flex grow half-wide justify-content-center">
      <h4 class="txt-center">Personnel</h4>
      </div>
    </div>

    <div class="m-box v-container">
    <div id="event-staff-number-map" class="v-container scrollable-box disp-flex grow scroll-smooth bordered">

    </div>
    </div>
    `;
  
  return table;
}

function createCompetencesTable() {
  let table = document.createElement('div');
  table.classList.add('v-container', 'align-items-center');
  table.innerHTML = `
    <div class="v-container align-items-center">
    <h3 class="txt-center">Competences de</h3>

    <div class="h-container align-items-center wide m-width">
      <div class="disp-flex grow half-wide justify-content-center">
      <h4 class="txt-center">Participants</h4>
      </div>
      <div class="disp-flex grow half-wide justify-content-center">
      <h4 class="txt-center">Personnel</h4>
      </div>
    </div>

    <div class="m-box v-container">
    <div class="h-container">
    <div class="searching-field h-container disp-flex grow half-wide"><div class="arrow">></div><input class="searching-input" type="text" placeholder="Trouver"></input></div>
    <div class="searching-field h-container disp-flex grow half-wide"><div class="arrow">></div><input class="searching-input" type="text" placeholder="Trouver"></input></div>
    </div>
    <div class="h-container grow">
    <div id="event-attendee-diplomes" class="text-box v-container scrollable-box scroll bordered grow half-wide">
    <button class="hover snap-start">Diplome #3</button>
    </div>
    <div id="event-staff-diplomes" class="text-box v-container scrollable-box scroll bordered grow half-wide">
    <button class="hover snap-start">Diplome #3</button>
    </div>
    </div>
    </div>
    </div>
    `;

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
    createSearchMenu('Personelle'),
    createStaffTable(),
    createCompetencesTable(),
    createFooterOptions(),
  );
}

const data = new DataManager();
window.data = data;

function createTemplateLine() {
  let line = document.createElement('div');
  line.className = 'h-container align-items-center wide';
  line.innerHTML = tmplHTML
  return line;
}

function resetEventInfoView() {
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
    button.addEventListener('click', function() {
      handle2StateButtonClick(button);
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

document.addEventListener('DOMContentLoaded', async (event) => {
  elms.bodyContainer = document.getElementById('body-container');
  elms.markerBlocks = document.getElementsByClassName('block-marker');
  elms.calendarBody = document.getElementById('calendar-body');
  elms.calendarContent = document.getElementById('calendar-content');
  elms.createOptionMenu = document.getElementById('create-option-menu');
  elms.monthDisplay = document.getElementById('month-display');
  elms.nameList = document.getElementById('name-list');
  elms.rightClickMenu = document.getElementById('right-click-menu');
  elms.sideMenuContainer = document.getElementById('side-menu-container');
  elms.venueList = document.getElementById('venue-list');
  elms.view[viewId.CALENDER] = document.getElementsByClassName('view-content')[0];

  zones[1].eList = document.getElementById("view-type").children;

  setMonthScrollPosition();
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.addEventListener('mousedown', handleMouseDown);
  calendarBody.addEventListener('mouseup', handleMouseUp);
  calendarBody.addEventListener('mousemove', handleMouseMove);

  fetch('/data')
  .then(resp => {
    if (!resp.ok) {
      throw new Error(`HTTP error! status: ${resp.status}`);
    }
    resp.arrayBuffer().then(
      bin => {
        const r = new BufferReader(bin);
        data.read(r)
        setUiList(elms.nameList, data.staffNames);
        setUiList(elms.venueList, data.venueNames);
        for (let i = 0; i < data.eventNames.length; i++) { // @nocheckin: factor out
          const name = data.eventNames[i];
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
        for (let i = 0; i < data.staffNames.length; i++) {
          const name = data.staffNames[i];
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
        for (let i = 0; i < data.venueNames.length; i++) {
          const name = data.venueNames[i];
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
});

document.addEventListener('click', (event) => {
  if (event.target.id === 'new-event-button' || event.target.id === 'info-event-button') {
  // we fucking can't do that in click function because after this button
  // handling function we get immidiately a click event and that is fucking
  // retarded because this handleClickForOptionMenu function closes the menu
  // and we don't get the menu
    document.addEventListener('click', handleClickForOptionMenu);
  }
});

document.addEventListener('contextmenu', function(e) {
  const menu = elms.rightClickMenu;
  let show = true;
  let target = null;
  if (elms.sideMenu.contains(e.target)) {
    document.getElementById('new-event-button').classList.replace('disp-none', 'disp-block');
  } else if (elms.nameList.contains(e.target)) {
    document.getElementById('new-member-button').classList.replace('disp-none', 'disp-block');
  } else if (elms.venueList.contains(e.target)) {
    document.getElementById('new-venue-button').classList.replace('disp-none', 'disp-block');
  } else if (e.target.classList.contains('editable')) {
    document.getElementById('edit-button').classList.replace('disp-none', 'disp-block');
    contextmenuData.target = e.target;
  } else if (target = e.target.closest('.deletable')) { 
    document.getElementById('delete-button').classList.replace('disp-none', 'disp-block');
    contextmenuData.target = target;
  } else {
    show = false;
  }

  for (const button of elms.sideMenu.children) { // @nocheckin, ??
    if (button.contains(e.target)) {
      show = true;
      let infoButton = document.getElementById('info-event-button');
      infoButton.classList.replace('disp-none', 'disp-block');
      callbacks.showInfo = { func: showInfo(button), obj: infoButton };
      infoButton.addEventListener('click', callbacks.showInfo.func);
      break;
    }
  }

  if (show) {
    e.preventDefault();
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', e.clientX + 'px');
    menu.style.setProperty('--menu-top', e.clientY + 'px');
    document.addEventListener('click', handleClickForContextMenu);
  }
});

function showInfo(element) {
  return function() {
    const rect = element.getBoundingClientRect();
    let menu = document.getElementById('create-option-menu');
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', rect.right + 'px');
    menu.style.setProperty('--menu-top', rect.top + 'px');
  }
}

function switchToCalendarView() {
  elms.bodyContainer.replaceChild(elms.view[viewId.CALENDER], elms.bodyContainer.children[1]);
}
window.switchToCalendarView = switchToCalendarView;

function switchToInformationView() {
  elms.bodyContainer.replaceChild(elms.view[viewId.INFORMATION], elms.bodyContainer.children[1]);

}
window.switchToInformationView = switchToInformationView;

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

function postString(url, str) {
  let writer = new BufferWriter();
  writer.writeString(str);
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }})
    .catch(e => {
      console.error(`Error: ${e}`);
    });
}

function handleAddToList(target, placeholder, url, storage) {
  const button = document.createElement('button');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  button.appendChild(input);
  target.appendChild(button);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      input.remove();
      button.textContent = value;
      storage.push(value);
      button.addEventListener('click', function() {
        handle2StateButtonClick(this);
      });

      button.className = 'hover';
      postString(url, value);
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });
}

let contextmenuData = {
  target: null,
};

document.getElementById('new-member-button').addEventListener('click', function() {
  handleAddToList(elms.nameList, 'Nouveau Agent', '/store/agent', data.staffNames);
});

document.getElementById('new-venue-button').addEventListener('click', function() {
  handleAddToList(elms.venueList, 'Nouveau Lieu', '/store/venue', data.venueNames);
});

document.getElementById('edit-button').addEventListener('click', function() {
  let b = contextmenuData.target;
  numInput.elm.value = b.textContent;
  b.replaceWith(numInput.elm);
  numInput.elm.focus();

  const _eventId = zones[zonesId.EVENTLIST].selection;
  let dataArray = null;
  let idx = -1;

  if (b.id === 'event-duration') {
    numInput.endOfWriting = () => {
      const _eventId = zones[zonesId.EVENTLIST].selection;
      if (numInput.elm.value === '') {
        b.textContent = '\u00A0';
        data.eventDuration[_eventId] = -1;
        function localCallback() {
          b.replaceWith(numInput.elm);
          numInput.elm.focus();
          numInput.endOfWriting = () => { endOfWriting() };
        }
        function endOfWriting() {
          const _eventId = zones[zonesId.EVENTLIST].selection;
          numInput.elm.replaceWith(b);
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
        b.textContent = numInput.elm.value;
        data.eventDuration[_eventId] = Number(b.textContent);
      }
      numInput.elm.replaceWith(b);
    };
  } else { // @nocheckin: we should probably set a special class on a button or somewhat like that
    numInput.endOfWriting = () => {
      const _eventId = zones[zonesId.EVENTLIST].selection;
      if (numInput.elm.value === '') {
        b.textContent = '\u00A0';
        data.eventPersonalNumMap[_eventId][b._dIdx] = -1;
        function localCallback() {
          b.replaceWith(numInput.elm);
          numInput.elm.focus();
          numInput.endOfWriting = () => { endOfWriting() };
        }
        function endOfWriting() {
          numInput.elm.replaceWith(b);
          const _eventId = zones[zonesId.EVENTLIST].selection;
          if (numInput.elm.value === '') {
            data.eventPersonalNumMap[_eventId][b._dIdx] = -1;
            return;
          }
          b.textContent = numInput.elm.value;
          data.eventPersonalNumMap[_eventId][b._dIdx] = Number(numInput.elm.value);
          b.classList.add('editable');
          b.removeEventListener('click', localCallback);
        }
        b.addEventListener('click', localCallback);
      } else {
        b.textContent = numInput.elm.value;
        data.eventPersonalNumMap[_eventId][b._dIdx] = Number(b.textContent);
      }
      numInput.elm.replaceWith(b);
    };
  }
});

document.getElementById('delete-button').addEventListener('click', function() {
  contextmenuData.target.remove();
  let idx = contextmenuData.target._dIdx*3;
  let dataarr = data.eventPersonalNumMap[zones[zonesId.EVENTLIST].selection];
  let list = document.getElementById('event-staff-number-map');
  let btns = list.querySelectorAll('button');
  for (let i = idx+3; i<dataarr.length; i += 3) {
    btns[i-3]._dIdx -= 3;
    btns[i-2]._dIdx -= 3;
    btns[i-1]._dIdx -= 3;
    dataarr[i-3] = dataarr[i];
    dataarr[i-2] = dataarr[i+1];
    dataarr[i-1] = dataarr[i+2];
  }
  dataarr.length -= 3;
});

function handleClickForOptionMenu(event) {
  let menu = elms.createOptionMenu;
  if (!menu.contains(event.target) && !elms.rightClickMenu.contains(event.target)) {
    menu.classList.replace('disp-flex', 'disp-none');

    document.removeEventListener('click', handleClickForOptionMenu);
    let input = menu.querySelectorAll('input')[0];
    callbacks.handleTyping.obj.removeEventListener('input', callbacks.handleTyping.func); // @nocheckin: we have an error here
    callbacks.handleTyping = { func: null, obj: null };
    let value = input.value;

    if (value !== "") {
      const staffIds = [];
      const nameList = elms.nameList;
      for (const name of nameList.children) {
        if (name.classList.contains('clicked')) {
          name.classList.remove('clicked');
          staffIds.push(parseInt(name._idx));
        }
      }

      const venueIds = [];
      const venueList = elms.venueList;
      for (const venue of venueList.children) {
        if (venue.classList.contains('clicked')) {
          venue.classList.remove('clicked');
          venueIds.push(parseInt(venue._idx));
        }
      }

      const writer = new BufferWriter();
      writer.writeString(input.value);
      writer.writeInt32Array(staffIds);
      writer.writeInt32Array(venueIds);

      fetch("store/event", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: writer.getBuffer(),
      })
        .then(resp => {
          if (!resp.ok) {
            throw new Error(`HTTP error! status: ${resp.status}`);
          }})
        .catch(e => {
          console.error(`Error: ${e}`);
        });
    } else {
      let menu = document.getElementById('side-menu');
      if (state.focusedElement) {
        menu.removeChild(state.focusedElement);
        state.focusedElement = null;
      }
    }

    input.value = "";
  }
};

function handleClickForContextMenu() {
  let menu = elms.rightClickMenu;
  menu.classList.replace('disp-flex', 'disp-none');
  document.removeEventListener('click', handleClickForContextMenu);
  if (callbacks.showInfo.obj && callbacks.showInfo.func) {
    callbacks.showInfo.obj.removeEventListener('click', callbacks.showInfo.func);
  }
  callbacks.showInfo = { func: null, obj: null };
  for (const child of menu.children) {
    child.classList.replace('disp-block', 'disp-none');
  }
}

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

document.getElementById('new-event-button').addEventListener('click', 
  function() {
    let menu = elms.sideMenu;
    let new_button = document.createElement('button');
    new_button.classList.add('event-button');
    new_button.textContent = "Nouvel Événement";
    menu.appendChild(new_button);

    const rect = new_button.getBoundingClientRect();
    menu = document.getElementById('create-option-menu');
    menu.classList.replace('disp-none', 'disp-flex');
    menu.style.setProperty('--menu-left', rect.right + 'px');
    menu.style.setProperty('--menu-top', rect.top + 'px');

    let input = menu.querySelectorAll('input')[0];
    input.focus();

    state.focusedElement = new_button;
    callbacks.handleTyping.func = function(event) {
      if (event.target.value === "") {
        new_button.textContent = "Nouvel Événement";
      } else {
        new_button.textContent = event.target.value;
      }
    };

    input.addEventListener('input', callbacks.handleTyping.func);
    callbacks.handleTyping.obj = input;
  });

function handle2StateButtonClick(b) {
  b.classList.toggle('clicked');
}
window.handle2StateButtonClick = handle2StateButtonClick;
