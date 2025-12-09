import {
  setMonthScrollPosition,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} from './scrollable_calendar.js';

import { palette } from './color.js';
import { BufferReader, BufferWriter } from './Io.js';

const MS_IN_DAY = 86400000;

let state = {
  sideMenuIsOpen: false,
  viewSelection: 0,
  datasetSelection: 0,
  eventsSelection: -1,
  staffSelection: -1,
  venueSelection: -1,
  handleTyping: null,
  focusedElement: null,
  baseDayNumber: 0,
  isUpdating: false,
};

function storeValue(array, freeList, value) {
  if (freeList.length > 0) {
    const index = freeList.pop();
    array[index] = value;
    return index;
  } else {
    array.push(value);
    return array.length - 1;
  }
}

function deleteValue(array, freeList, index) {
  if (array[index] === null) {
    return;
  }
  array[index] = null;
  freeList.push(index);
}

function deleteOccurences(array, value) {
  for (let i = 0; i < array.length; i++) {
    array[i] = array[i].filter(
      arrayValue => arrayValue !== value
    );
  }
}

function getAll(array) {
  const retval = [];
  for (let i = 0; i < array.length; i++) {
    if (array[i] !== null) {
      retval.push({idx: i, val: array[i]});
    }
  }
  return retval;
}

class DataManager {
  constructor() {
      this.eventNames = [];
      this.eventStaff = [];
      this.eventVenues = [];
      this.eventStaffDiplReq = [];
      this.eventAttendeeDiplReq = [];
      this.eventDuration = [];
      this.eventFreeList = [];

      this.staffNames = [];
      this.staffFreeList = [];
      this.venueNames = [];
      this.venueFreeList = [];

      this.staffsDiplomesNames = [];
      this.attendeesDiplomesNames = [];
  }

  storeEvent(name, staffIndices = [], venueIndices = []) {
    const idx = storeValue(this.eventNames, this.eventFreeList, name);
    this.eventStaff[idx] = staffIndices;
    this.eventVenues[idx] = venueIndices;
    return idx;
  }

  deleteEvent(idx) {
    deleteValue(this.eventNames, this.eventFreeList, idx);
    this.eventStaff[idx] = null;
    this.eventVenues[idx] = null;
  }

  storeStaff(name) {
    return storeValue(this.staffNames, this.staffFreeList, name);
  }

  deleteStaff(idx) {
    deleteValue(this.staffNames, this.staffFreeList, idx);
    deleteOccurences(this.eventStaff, idx);
  }

  storeVenue(name) {
    return storeValue(this.venueNames, this.venueFreeList, name);
  }

  deleteVenue(idx) {
    deleteValue(this.venueNames, this.venueFreeList, idx);
    deleteOccurences(this.eventVenues, idx);
  }

  getEvent(idx) {
    return {
      idx: idx,
      name: this.eventNames[idx],
      staff: this.eventStaff[idx] || [],
      venues: this.eventVenues[idx] || [],
    };
  }

  addStaffToEvent(eventIndex, staffIndex) {
    if (!this.eventStaff[eventIndex].includes(staffIndex)) {
      this.eventStaff[eventIndex].push(staffIndex);
    }
  }

  removeStaffFromEvent(eventIndex, staffIndex) {
    this.eventStaff[eventIndex] = this.eventStaff[eventIndex].filter(
      idx => idx !== staffIndex
    );
  }

  addVenueToEvent(eventIndex, venueIndex) {
    if (!this.eventVenues[eventIndex].includes(venueIndex)) {
      this.eventVenues[eventIndex].push(venueIndex);
    }
  }

  removeVenueFromEvent(eventIndex, venueIndex) {
    this.eventVenues[eventIndex] = this.eventVenues[eventIndex].filter(
      idx => idx !== venueIndex
    );
  }

  read(reader) {
    const version = "bin_state.v0.0.1"; 
    const format = reader.readString();
    
    if (version != format) {
      throw new Error(`reading format: \`${format}\`. Supporting format: \`${version}\``);
    }

    this.eventNames = reader.readStringArray();
    this.eventStaff = reader.readArrayOfInt32Arrays();
    this.eventVenues = reader.readArrayOfInt32Arrays();
    this.eventStaffDiplReq = reader.readInt32Array();
    this.eventAttendeeDiplReq = reader.readInt32Array();
    this.eventDuration = reader.readInt32Array();
    this.staffNames = reader.readStringArray();
    this.venueNames = reader.readStringArray();
    this.staffsDiplomesNames = reader.readStringArray();
    this.attendeesDiplomesNames = reader.readStringArray();
  }
}

const data = new DataManager();
window.data = data;

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
  calendarView: null,
  informationView: null,
  dataListContainer: document.createElement('div'),
  eventDatalist: document.createElement('div'),
  staffDatalist: document.createElement('div'),
  venueDatalist: document.createElement('div'),
}
window.elms = elms;

{
  elms.sideMenu.classList.add('v-container');
  elms.sideMenu.id = 'side-menu';
  elms.sideMenu.innerHTML = `
    <div class="header-container">
    <div id="data-type" class="button-container">
    <button>Événements</button>
    <button>Personnel</button>
    <button>Lieux</button>
    </div>
    </div>
    <div id="data-list-container"></div>
    `;
  elms.sideMenu.appendChild(elms.dataListContainer);
  elms.dataListContainer.appendChild(elms.eventDatalist);
}

{
  elms.informationView = document.createElement('div');
  elms.informationView.classList.add('view-content');
  elms.informationView.classList.add('v-container');
  elms.informationView.innerHTML = `
    <div class="h-container" style="flex-grow: 1 0 auto; width: 100%; justify-items: center;">
    <div style="display: flex; flex-grow: 1; width: 50%; justify-content: center;">
    <table style="width: 200px;">
    <caption>
    Nomber de
    </caption>
    <thead>
    <tr>
    <th>Stagier</th><th>Formateur</th>
    </tr>
    </thead>

    <tbody>
    <tr><td>
    de <button class="hover">5</button> à <button class="hover">6</button></td>
    <td><button class="hover">1</button></td></tr>
    <tr><td>
    de <button class="hover">7</button> à <button class="hover">12</button></td>
    <td><button class="hover">2</button></td></tr>
    <tr><td>
    de <button class="hover"> </button> à <button class="hover"> </button></td>
    <td><button class="hover"> </button></td></tr>
    </tbody>
    </table>
    </div>

    <div style="display: flex; flex-grow: 1; width: 50%; justify-content: center;">
    <table style="width: 200px;">
    <caption>
    Competences de
    </caption>
    <thead>
    <tr>
    <th>Stagier</th><th>Formateur</th>
    </tr>
    </thead>

    <tbody>
    <tr><td>
    de <button class="hover">5</button> à <button class="hover">6</button></td>
    <td><button class="hover">1</button></td></tr>
    <tr><td>
    de <button class="hover">7</button> à <button class="hover">12</button></td>
    <td><button class="hover">2</button></td></tr>
    <tr><td>
    de <button class="hover"> </button> à <button class="hover"> </button></td>
    <td><button class="hover"> </button></td></tr>
    </tbody>
    </table>
    </div>

    </div>
    <div>
    Durée: <button class="hover">1</button>d
    </div>
  `
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
  elms.monthDisplay.innerHTML = '<strong>'+months[date.getMonth()]+'</strong> '+date.getFullYear();
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
    button.onclick = function() {
      handle2StateButtonClick(this);
    };
    button.className = 'hover';
    button.textContent = list[i];
    button.dataset.idx = i;
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
  date.setTime(Number(elms.calendarContent.children[0].children[0].dataset.dayNum)*MS_IN_DAY)
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
    testDate.setTime(Number(day.dataset.dayNum)*MS_IN_DAY);
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
    testDate.setTime(Number(day.dataset.dayNum)*MS_IN_DAY);
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
  elms.calendarView = document.getElementsByClassName('view-content')[0];

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
        for (let i = 0; i < data.eventNames.length; i++) {
          const name = data.eventNames[i];
          let button = document.createElement('button');
          button.classList.add('event-button');
          button.setAttribute('onclick', 'handleClickOnButton(this, zonesId.EVENTLIST)');
          elms.eventDatalist.appendChild(button);
          button.textContent = name;
          button.dataset.bIdx = i;
        }
      });
  })
  .catch(e => {
    console.error('Could not fetch data:', e);
  });

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
        const originalScrollBehavior = elms.calendarBody.style.scrollBehavior;
        elms.calendarBody.style.scrollBehavior = 'auto';
        elms.calendarBody.scrollTop -= shiftingBy*week.offsetHeight;
        elms.calendarBody.style.scrollBehavior = originalScrollBehavior;
        requestAnimationFrame(() => {
          state.baseDayNumber += shiftingBy*7;
          let date = new Date();
          const today = Math.floor(date.getTime()/MS_IN_DAY);
          const offset = today - state.baseDayNumber;

          date.setTime(state.baseDayNumber*MS_IN_DAY);
          const focusMonth = focus.date.getMonth();
          iterateOverDays((day) => {
            day.children[0].textContent = date.getDate();
            day.dataset.dayNum = Math.floor(date.getTime() / MS_IN_DAY);
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
      day.dataset.dayNum = Math.floor(date.getTime() / MS_IN_DAY);
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

// @nocheckin: factor out
document.addEventListener('contextmenu', function(e) {
  const menu = elms.rightClickMenu;
  if (elms.sideMenu.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-event-button').style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
  } else if (elms.nameList.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-member-button').style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
  } else if (elms.venueList.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-venue-button').style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
  } 

  for (const button of elms.sideMenu.children) {
    if (button.contains(e.target)) {
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      let infoButton = document.getElementById('info-event-button');
      infoButton.style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
      infoButton.onclick = showInfo(button);
    }
  }
});

function showInfo(element) {
  return function() {
    const rect = element.getBoundingClientRect();
    let menu = document.getElementById('create-option-menu');
    menu.style.display = 'flex';
    menu.style.left = rect.right + 'px';
    menu.style.top = rect.top + 'px';
  }
}

function switchToCalendarView() {
  elms.bodyContainer.replaceChild(elms.calendarView, elms.bodyContainer.children[1]);
}
window.switchToCalendarView = switchToCalendarView;

function switchToInformationView() {
  elms.bodyContainer.replaceChild(elms.informationView, elms.bodyContainer.children[1]);

}
window.switchToInformationView = switchToInformationView;

function handleClickOnSideMenuButton(button) {
  let sideMenuContainer = elms.sideMenuContainer;
  if (state.sideMenuIsOpen) {
    sideMenuContainer.removeChild(elms.sideMenu);
  } else {
    sideMenuContainer.appendChild(elms.sideMenu);
  }
  state.sideMenuIsOpen ^= true;
}
window.handleClickOnSideMenuButton = handleClickOnSideMenuButton;

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
      button.onclick = function() {
        handle2StateButtonClick(this);
      };
      button.className = 'hover';
      postString(url, value);
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });
}
window.handleAddToList = handleAddToList;

function handleClickForOptionMenu(event) {
  let menu = elms.createOptionMenu;
  if (!menu.contains(event.target) && !elms.rightClickMenu.contains(event.target)) {
    menu.style.display = 'none';
    document.removeEventListener('click', handleClickForOptionMenu);
    let input = menu.querySelectorAll('input')[0];
    input.removeEventListener('input', state.handleTyping);
    let value = input.value;

    if (value !== "") {
      const staffIds = [];
      const nameList = elms.nameList;
      for (const name of nameList.children) {
        if (name.classList.contains('clicked')) {
          name.classList.remove('clicked');
          staffIds.push(parseInt(name.dataset.idx));
        }
      }

      const venueIds = [];
      const venueList = elms.venueList;
      for (const venue of venueList.children) {
        if (venue.classList.contains('clicked')) {
          venue.classList.remove('clicked');
          venueIds.push(parseInt(venue.dataset.idx));
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
  menu.style.display = 'none';
  document.removeEventListener('click', handleClickForContextMenu);
  for (const child of menu.children) {
    child.style.display = 'none';
  }
}

const zonesId = {
  DATATYPE: 0,
  VIEWTYPE: 1,
  EVENTLIST: 2,
  STAFFLIST: 3,
  VENUELIST: 4,
};
window.zonesId = zonesId;

let zones = [
  {
    selection: 0,
    eList: document.getElementById("data-type"),
  },
  {
    selection: 0,
    eList: document.getElementById("view-type"),
  },
  {
    selection: -1,
    eList: elms.eventDatalist.children,
  },
  {
    selection: -1,
    eList: elms.staffDatalist.children,
  },
  {
    selection: -1,
    eList: elms.venueDatalist.children,
  },
];

function handleClickOnButton(b, zn) {
  const z = zones[zn];
  if (z.selection == b.dataset.bIdx) {
    b.style.backgroundColor = 'transparent';
    z.selection = -1;
    return;
  }
  b.style.backgroundColor = palette.blue;
  if (z.selection >= 0) {
    z.eList[z.selection].style.backgroundColor = 'transparent';
  }
  z.selection = b.dataset.bIdx;
}
window.handleClickOnButton = handleClickOnButton;

function handleCreateNewEvent() {
  let menu = elms.sideMenu;
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
  
  state.focusedElement = new_button;
  state.handleTyping = function(event) {
    if (event.target.value === "") {
      new_button.textContent = "Nouvel Événement";
    } else {
      new_button.textContent = event.target.value;
    }
  };

  input.addEventListener('input', state.handleTyping);
}
window.handleCreateNewEvent = handleCreateNewEvent;

function handle2StateButtonClick(b) {
  b.classList.toggle('clicked');
}
window.handle2StateButtonClick = handle2StateButtonClick;
