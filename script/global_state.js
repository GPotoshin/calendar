import * as DM from './data_manager.js';

export let elms = {
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
};

// eList is the list of buttons, that way we have a direct access to it
export let zones = [
  { selection: null, eList: null },
  { selection: null, eList: null },
  { selection: null, eList: document.createElement('div') },
  { selection: null, eList: document.createElement('div') },
  { selection: null, eList: document.createElement('div') },
];

export const data = new DM.DataManager();
window.data = data;
