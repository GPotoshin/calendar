import { privilege, token } from './login.js';
import * as Io from './io.js';

export let elements = {
  calendar_body: document.getElementById('calendar-body'),
  month_display: document.getElementById('month-display'),
  right_click_menu: document.getElementById('right-click-menu'),
  option_menu: document.getElementById('option-menu'),
  side_menu: document.createElement('div'),
  body_container: document.getElementById('body-container'),
  side_menu_container: null,
  todayFrame: null,
  dataListContainer: null,
  views: [document.getElementsByClassName('view-content')[0], null],
}

export let callbacks = {
  handleTyping: {func: null, obj: null},
}

export const view_identifier = {
  CALENDER: 0,
  INFORMATION: 1,
};

export const PRIVILEGE_LEVEL_ADMIN = -2;
export const PRIVILEGE_LEVEL_USER  = -1

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
  STAFF_NUMBER_MAP: 8,
  STAFF_NUMBER_MAP_FIELD: 9,
  DURATION: 10,
  EMPLOYEES_LIMIT: 11,
  PRIVILEGE_LEVEL: 12,
  DUTY_STATION: 13,
};

// eList is the list of buttons, that way we have a direct access to it
export let zones = [
  { selection: null, element_list: null },
  { selection: null, element_list: document.getElementById("view-type").children },
  { selection: null, element_list: null, content: document.createElement('div') },
  { selection: null, element_list: null, content: document.createElement('div') },
  { selection: null, element_list: null, content: document.createElement('div') },
];


export function getZoneUserIdentifier() {
  const zone = zones[zones_identifier.STAFF];
  if (zone.selection == null) {
    return undefined;
  }
  return zone.selection._data_identifier;
}

export function getZoneUserIndex() {
  const user_identifier = getZoneUserIdentifier();
  return data.users_map.get(user_identifier);
}

export function getEventSelectionIdentifier() {
  const selection = zones[zones_identifier.EVENT].selection;
  if (selection) {
    return zones[zones_identifier.EVENT].selection._data_identifier;
  }
  return undefined;
}

export function viewIsInformation() {
 return zones[zones_identifier.VIEW_TYPE].selection._data_identifier
    === view_identifier.INFORMATION;
}

export function getEventsDuration(identifier) {
  const event_index = data.events_map.get(identifier);    
  if (event_index !== undefined) {
    return data.events_duration[event_index];
  }
  return undefined;
}

export function getOccurrencesEvent(identifier) {
  const occurrence_index = data.occurrences_map.get(identifier);
  if (occurrence_index !== undefined) {
    return data.occurrences_event_identifier[occurrence_index];
  }
  return undefined;
}

let _data = null;

if (privilege == -2) {
  const { AdminData } = await import('./admin_data.js');
  _data = new AdminData();
} else if (privilege == -1) {
  const { UserData } = await import('./user_data.js');
  _data = new UserData();
} else if (privilege >= 0) {
  const { ChefData } = await import('./chef_data.js');
  _data = new ChefData();
}

export const data = _data;

export function bundleCompetencesNames() {
  return {
    map: data.competences_map,
    array: data.competences_name,
    free_list: data.competences_free_list,
  };
}
export function bundleEventsNames() {
  return {
    map: data.events_map,
    array: data.events_name,
    free_list: data.events_free_list,
  };
}
export function bundleVenuesNames() {
  return {
    map: data.venues_map,
    array: data.venues_name,
    free_list: data.venues_free_list,
  };
}
export function bundleRolesNames() {
  return {
    map: data.roles_map,
    array: data.roles_name,
    free_list: data.roles_free_list,
  };
}

window.data = data; // @nocheckin: only in dev

export const PARTICIPATION_REQUESTED = 0;
export const PARTICIPATION_APPROVED  = 1;
export const PARTICIPATION_DECLINED  = 2;

async function waitForUpdate() {
  const writer = new Io.BufferWriter();
  Io.writeHash(writer, token);

  const response = await fetch('/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: writer.getBuffer(),
  });

  const binary = await response.arrayBuffer();
  const reader = new Io.BufferReader(binary);
  // handle update here
  console.log("we are getting an update");

  waitForUpdate();
}

waitForUpdate();
