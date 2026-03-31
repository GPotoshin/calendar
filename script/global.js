import {storeValue, deleteValue, removeAllOf, storageIndex} from './data_manager.js';
import * as Login from './login.js';
import * as Io from './io.js';
import * as Calendar from './calendar.js';
import * as Api from './api.js';
import * as StaffInformation from './staff_information.js';
import * as EventInformation from './event_information.js';

export const privilege = Login.privilege;
export const token = Login.token;
export let public_key = Login.public_key;

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
  calendar_button: null,
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

export function createUser(matricule, name, surname) {
  let index = -1;
  if (data.users_map != nil) {
    index = storageIndex(data.users_map, data.users_free_list);
  } else {
    return;
  }
  data.users_map.set(matricule, index);
  if (data.users_name != null) storeValue(data.users_name, index, name);
  if (data.users_surname != null) storeValue(data.users_surname, index, surname);
  if (data.users_mail != null) storeValue(data.users_mail, index, '');
  if (data.users_phone != null) storeValue(data.users_phone, index, 0);
  if (data.users_competences != null) storeValue(data.users_competences, index, []);
  if (data.users_duty_station != null) storeValue(data.users_duty_station, index, -1);
  if (data.users_privilege_level != null) storeValue(data.users_privilege_level, index, PRIVILEGE_LEVEL_USER);
  if (data.users_applications != null) storeValue(data.users_applications,    index, []);
}

export function deleteUser(mat) {
  if (data.users_map != null) deleteValue(data.users_map, data.users_free_list, mat);
    else return
  if (data.occurrences_participants != null) removeAllOf(data.occurrences_participants, mat);
}

export function updateUser(mat, new_mat, name, surname) {
  const index = data.users_map.get(mat);
  if (index !== undefined) {
    if (new_identifier !== mat) {
      data.users_map.delete(mat);
      data.users_map.set(new_mat, index);
    }
    data.users_name[index]    = name;
    data.users_surname[index] = surname;
  } else {
    createUser(new_mat, name, surname);
  }
}

export function createEvent(id, name) {
  const index = storageIndex(data.events_map, data.events_free_list);
  data.events_map.set(id, index);

  storeValue(data.events_name,               index, name);
  storeValue(data.events_venues,             index, []);
  storeValue(data.events_roles,              index, []);
  storeValue(data.events_roles_requirements, index, [[]]);
  storeValue(data.events_staff_number_map,   index, []);
  if (data.events_duration != null) storeValue(data.events_duration, index, -1);
}

export function deleteEvent(id) {
  const event_index = data.events_map.get(id);
  if (event_index == null) {
    unexistingError("event");
    return;
  }

  if (data.events_name != null) data.events_name[event_index] = "";
  if (data.events_venues != null) data.events_venues[event_index].length = 0;
  if (data.events_roles != null) data.events_roles[event_index].length = 0;
  if (data.events_roles_requirements != null) data.events_roles_requirements[event_index].length = 0;
  if (data.events_staff_number_map != null) data.events_staff_number_map[event_index].length = 0;
  if (data.events_duration != null) data.events_duration[event_index] = -1;
  deleteValue(data.events_map, data.events_free_list, id);
}

export function deleteVenue(id) {
  if(data.venue_map != null) deleteValue(data.venues_map, data.venues_free_list, id);
  if(data.events_venues != null) removeAllOf(data.events_venues, id);
}

export function updateUsersDutyStation(user_id, center_id) {
  let user_index = -1;
  if (data.users_map != null) user_index = data.users_map.get(user_id);
    else return
  if (user_index != null) data.users_duty_station[user_index] = center_id;
    else unexistingError("user");
}

export function updateUsersPrivilegeLevel(user_id, p_level) {
  let index = -1;
  if (data.users_map != null) index = data.users_map.get(user_id);
    else return
  if (index != null) {
    data.users_privilege_level[index] = p_level;
  }
  else unexistingError("user");
}

export function createRole(id, name) {
  const index = storageIndex(data.roles_map, data.roles_free_list);
  data.roles_map.set(id, index);
  storeValue(data.roles_name, index, name);
}

export function createCompetence(id, name) {
  const index  = storageIndex(data.competences_map, data.competences_free_list);
  data.competences_map.set(id, index);
  storeValue(data.competences_name, index, name);
}

export function createVenue(id, name) {
  const index  = storageIndex(data.venues_map, data.venues_free_list);
  data.venues_map.set(id, index);
  storeValue(data.venues_name, index, name);
}

export function createEventsRole(event_id, role_id) {
  const event_index = data.events_map.get(event_id);
  data.events_roles[event_index].push(role_id);
  for (const line of data.events_staff_number_map[event_index]) {
    line.push(-1);
  }
  data.events_roles_requirements[event_index].push([]);
}

export function deleteEventsRole(event_id, role_id) {
  const event_index = data.events_map.get(event_id);
  const pos = data.events_roles[event_index].indexOf(role_id);
  if (pos === -1) return;
  data.events_roles[event_index].splice(pos, 1);
  data.events_roles_requirements[event_index].splice(pos + 1, 1);
  for (const line of data.events_staff_number_map[event_index]) {
    line.splice(pos + 2, 1);
  }
}

export function createOccurrence(id, event_id, intervals) {
  const index = storageIndex(data.occurrences_map, data.occurrences_free_list);
  data.occurrences_map.set(id, index);

  storeValue(data.occurrences_event_identifier,     index, event_id);
  storeValue(data.occurrences_venue,                index, -1);
  storeValue(data.occurrences_dates,                index, intervals);
  if (data.occurrences_participants != null) storeValue(data.occurrences_participants, index, []);
  storeValue(data.occurrences_participants_role,    index, []);
  storeValue(data.occurrences_participants_status,  index, []);
}

export function pushToDayOccurrences(intervals, id) {
  if (data.day_occurrences.length === 0 && intervals.length > 0) {
    data.base_day_number = intervals[0][0];
  }

  for (const interval of intervals) {
    const start = Math.max(interval[0] - data.base_day_number, 0);
    const end   = interval[1] - data.base_day_number;
    for (let i = start; i <= end; i++) {
      if (!data.day_occurrences[i]) data.day_occurrences[i] = [];
      data.day_occurrences[i].push(id);
    }
  }
}

export function removeFromDayOccurrences(occurrence_identifier, occurrence_index) {
  const intervals = data.occurrences_dates[occurrence_index];
  for (const interval of intervals) {
    const start = interval[0] - data.base_day_number;
    const end   = interval[1] - data.base_day_number;
    for (let i = start; i <= end; i++) {
      if (data.day_occurrences[i]) {
        data.day_occurrences[i] = data.day_occurrences[i].filter(v => v !== occurrence_identifier);
      }
    }
  }
}

// @note: we probably should request it then
function unexistingError(subj) {
  console.error("referencing localy unexisting "+subj);
}

window.addEventListener('beforeunload', () => {
  abort_controller.abort();
});
