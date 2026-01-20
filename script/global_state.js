import * as DM from './data_manager.js';

export let tmpls = [ document.createElement('div'), null, null, null ];

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
  scope: [
    document.createElement('div'),
    document.createElement('div'),
    document.createElement('div'),
  ],
}

export let callbacks = {
  handleTyping: {func: null, obj: null},
}

export const listId = {
  EVENT: 0,
  STAFF: 1,
  VENUE: 2,
  EVENT_STAFF: 3,
  COMPETENCES: 4,
  NUMMAP: 5,
};

export const zonesId = {
  NONE: -1,
  DATATYPE: 0,
  VIEWTYPE: 1,
  EVENTLIST: 2,
  STAFFLIST: 3,
  VENUELIST: 4,
};

export const viewId = {
  CALENDER: 0,
  INFORMATION: 1,
};

export const scopeId = {
  EVENT: 0,
  STAFF: 1,
  VENUE: 2,
};

// eList is the list of buttons, that way we have a direct access to it
export let zones = [
  { selection: null, eList: null },
  { selection: null, eList: null },
  { selection: null, eList: elms.scope[scopeId.EVENT].children },
  { selection: null, eList: elms.scope[scopeId.STAFF].children },
  { selection: null, eList: elms.scope[scopeId.VENUE].children },
];

export const data = new DM.DataManager();
window.data = data;
