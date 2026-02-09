import * as DM from './data_manager.js';

export let elements = {
  calendar_body: document.getElementById('calendar-body'),
  calendar_content: document.getElementById('calendar-content'),
  marker_blocks: document.getElementsByClassName('block-marker'),
  month_display: document.getElementById('month-display'),
  right_click_menu: document.getElementById('right-click-menu'),
  side_menu: document.createElement('div'),
  body_container: document.getElementById('body-container'),
  side_menu_container: null,
  todayFrame: null,
  dataListContainer: null,

  view: [document.getElementsByClassName('view-content')[0], null],
}

export let callbacks = {
  handleTyping: {func: null, obj: null},
}

export const view_identifier = {
  CALENDER: 0,
  INFORMATION: 1,
};

export const zones_identifier = {
  NONE: -1,
  DATA_TYPE: 0,
  VIEW_TYPE: 1,
  EVENT: 2,
  STAFF: 3,
  VENUE: 4,
  SELECTABLE: 5,
  EVENT_STAFF: 6,
  COMPETENCES: 7,
  PERSONAL_NUMBER_MAP: 8,
  DURATION: 9,
  EMPLOYEES_LIMIT: 10,
};

// eList is the list of buttons, that way we have a direct access to it
export let zones = [
  { selection: null, element_list: null },
  { selection: null, element_list: document.getElementById("view-type").children },
  { selection: null, element_list: document.createElement('div') },
  { selection: null, element_list: document.createElement('div') },
  { selection: null, element_list: document.createElement('div') },
];

export const data = new DM.DataManager();
window.data = data; // @nocheckin: only in dev
