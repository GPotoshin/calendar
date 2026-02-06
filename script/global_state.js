import * as DM from './data_manager.js';

export let elements = {
  calendarBody: document.getElementById('calendar-body'),
  calendarContent: document.getElementById('calendar-content'),
  markerBlocks: document.getElementsByClassName('block-marker'),
  monthDisplay: document.getElementById('month-display'),
  rightClickMenu: document.getElementById('right-click-menu'),
  sideMenu: document.createElement('div'),
  bodyContainer: document.getElementById('body-container'),
  sideMenuContainer: null,
  todayFrame: null,
  dataListContainer: null,

  view: [document.getElementsByClassName('view-content')[0], null],
}

export let callbacks = {
  handleTyping: {func: null, obj: null},
}

export const viewId = {
  CALENDER: 0,
  INFORMATION: 1,
};

export const zonesId = {
  NONE: -1,
  DATATYPE: 0,
  VIEWTYPE: 1,
  EVENT: 2,
  STAFF: 3,
  VENUE: 4,
  SELECTABLE: 5,
  EVENTSTAFF: 6,
  COMPETENCES: 7,
  NUMMAP: 8,
  DURATION: 9,
  EMPLOYEESLIMIT: 10,
};

// eList is the list of buttons, that way we have a direct access to it
export let zones = [
  { selection: null, eList: null },
  { selection: null, eList: document.getElementById("view-type").children },
  { selection: null, eList: document.createElement('div') },
  { selection: null, eList: document.createElement('div') },
  { selection: null, eList: document.createElement('div') },
];

export const data = new DM.DataManager();
window.data = data; // @nocheckin: only in dev
