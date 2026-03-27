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

export async function waitForUpdate() {
  try {
    const writer = new Io.BufferWriter();
    Io.writeHash(writer, token);

    const response = await fetch('/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: writer.getBuffer(),
    });

    const binary = await response.arrayBuffer();
    const reader = new Io.BufferReader(binary);

    const field_identifier = Io.readInt32(reader);
    const mode             = Io.readInt32(reader);

    switch (field_identifier) {
      case Api.USERS_MAP: {
        const mat = Io.readInt32(reader);
        switch (mode) {
          case Api.CREATE: {
            const name    = Io.readString(reader);
            const surname = Io.readString(reader);
            createUser(mat, name, surename);
            break;
          }
          case Api.UPDATE: {
            const new_mat = Io.readInt32(reader);
            const name    = Io.readString(reader);
            const surname = Io.readString(reader);
            updateUser(mat, new_mat, name, surname);
            break;
          }
          case Api.DELETE: {
            deleteUser(mat);
            break;
          }
        }
        break;
      }

      case Api.USERS_DUTY_STATION: {
        const user_id    = Io.readInt32(reader);
        const center_id  = Io.readInt32(reader);
        updateUsersDutyStation(user_id, center_id)
        break;
      }

      case Api.USERS_PRIVILEGE_LEVEL: {
        const mat = Io.readInt32(reader);
        const p_level = Io.readInt32(reader);
        updateUserPrivilegeLevel(mat, p_level);
        break;
      }

      case Api.EVENTS_MAP: {
        switch (mode) {
          case Api.CREATE: {
            const id = Io.readInt32(reader);
            const name = Io.readString(reader);
            createEvent(id, name);
            break;
          }
          case Api.DELETE: {
            const id = Io.readInt32(reader);
            deleteEvent(id);
            break;
          }
          case Api.UPDATE: { // leaving it as right now
            const id       = Io.readInt32(reader);
            const new_name = Io.readString(reader);
            const index = data.events_map.get(id);
            if (index !== undefined) {
              data.events_name[index] = new_name;
            }
            break;
          }
        }
        break;
      }

      case Api.EVENTS_ROLE: {
        const event_id = Io.readInt32(reader);
        const role_id  = Io.readInt32(reader);
        switch (mode) {
          case Api.CREATE: {
            createEventsRole(event_id, role_id);
            break;
          }
          case Api.DELETE: {
            deleteEventsRole(event_id, role_id)
            break;
          }
        }
        break;
      }

      case Api.EVENTS_ROLES_REQUIREMENT: {
        const event_identifier     = Io.readInt32(reader);
        const role_ordinal         = Io.readInt32(reader);
        const competence_identifier = Io.readInt32(reader);
        const event_index = data.events_map.get(event_identifier);
        if (event_index === undefined) return;
        const requirements = data.events_roles_requirements[event_index][role_ordinal];
        if (requirements !== undefined) return;
        switch (mode) {
          case Api.CREATE:
            requirements.push(competence_identifier);
            break;
          case Api.DELETE: {
            const pos = requirements.indexOf(competence_identifier);
            if (pos !== -1) requirements.splice(pos, 1);
            break;
          }
        }
        break;
      }

      case Api.EVENTS_PERSONAL_NUM_MAP: {
        const event_identifier = Io.readInt32(reader);
        const event_index = data.events_map.get(event_identifier);
        if (event_index === undefined) return;
        switch (mode) {
          case Api.CREATE: {
            const row_data = Io.readInt32Array(reader);
            data.events_staff_number_map[event_index].push(row_data);
            break;
          }
          case Api.DELETE: {
            const line_index = Io.readInt32(reader);
            data.events_staff_number_map[event_index].splice(line_index, 1);
            break;
          }
          case Api.UPDATE: {
            const line_index = Io.readInt32(reader);
            const num_index  = Io.readInt32(reader);
            const val        = Io.readInt32(reader);
            data.events_staff_number_map[event_index][line_index][num_index] = val;
            break;
          }
        }
        break;
      }

      case Api.EVENTS_DURATION: {
        const event_identifier = Io.readInt32(reader);
        const duration         = Io.readInt32(reader);
        const event_index = data.events_map.get(event_identifier);
        if (event_index !== undefined) {
          data.events_duration[event_index] = duration;
        }
        break;
      }

      case Api.VENUES_MAP: {
        switch (mode) {
          case Api.CREATE: {
            const id = Io.readInt32(reader);
            const name = Io.readString(reader);
            createVenue(id, name);
            break;
          }
          case Api.DELETE: {
            const id = Io.readInt32(reader);
            deleteVenue(id);
            break;
          }
          case Api.UPDATE: {
            const id       = Io.readInt32(reader);
            const new_name = Io.readString(reader);
            const index = data.venues_map.get(id);
            if (index !== undefined) {
              data.venues_name[index] = new_name;
            }
            break;
          }
        }
        break;
      }

      case Api.COMPETENCES_MAP: {
        switch (mode) {
          case Api.CREATE: {
            const id = Io.readInt32(reader);
            const name = Io.readString(reader);
            createCompetence(id, name);
            break;
          }
          case Api.DELETE: {
            const id = Io.readInt32(reader);
            deleteValue(data.competences_map, data.competences_free_list, id);
            for (const [, event_index] of data.events_map) {
              removeAllOf(data.events_roles_requirements[event_index], id);
            }
            break;
          }
        }
        break;
      }

      case Api.ROLES_MAP: {
        switch (mode) {
          case Api.CREATE: {
            const id = Io.readInt32(reader);
            const name = Io.readString(reader);
            createRole(new_id, name);
            break;
          }
          case Api.DELETE: {
            const id = Io.readInt32(reader);
            deleteValue(data.roles_map, data.roles_free_list, id);
            removeAllOf(data.events_roles, id);
            break;
          }
        }
        break;
      }

      case Api.OCCURRENCES_MAP: {
        switch (mode) {
          case Api.CREATE: {
            const id = Io.readInt32(reader);
            const event_id = Io.readInt32(reader);
            const intervals = Io.readArrayOfInt32PairArrays(reader);

            createOccurrence(id, event_id, intervals);
            pushToDayOccurrences(intervals, id);
            break;
          }
          case Api.DELETE: {
            const occurrence_id = Io.readInt32(reader); // @error
            const occurrence_index = data.occurrences_map.get(occurrence_id);
            if (occurrence_index !== undefined) {
              removeFromDayOccurrences(occurrence_id, occurrence_index);
              deleteValue(data.occurrences_map, data.occurrences_free_list, occurrence_id);
            }
            break;
          }
        }
        break;
      }

      case Api.OCCURRENCES_DATES: {
        if (mode === Api.UPDATE) {
          const identifier = Io.readInt32(reader);
          const intervals  = Io.readArrayOfInt32PairArrays(reader);
          const index = data.occurrences_map.get(identifier);
          if (index !== undefined) {
            // remove old entries from day_occurrences
            for (const interval of data.occurrences_dates[index]) {
              const start = interval[0] - data.base_day_number;
              const end   = interval[1] - data.base_day_number;
              for (let i = start; i <= end; i++) {
                if (data.day_occurrences[i]) {
                  data.day_occurrences[i] = data.day_occurrences[i].filter(v => v !== identifier);
                }
              }
            }
            // add new entries
            for (const interval of intervals) {
              const start = Math.max(interval[0] - data.base_day_number, 0);
              const end   = Math.min(interval[1] - data.base_day_number, data.day_occurrences.length - 1);
              for (let i = start; i <= end; i++) {
                if (!data.day_occurrences[i]) data.day_occurrences[i] = [];
                data.day_occurrences[i].push(identifier);
              }
            }
            data.occurrences_dates[index] = intervals;
          }
        }
        break;
      }

      case Api.OCCURRENCES_PARTICIPANT: {
        if (mode === Api.CREATE) {
          const occurrence_id = Io.readInt32(reader);
          const user_id       = Io.readInt32(reader);
          const role_id       = Io.readInt32(reader);
          const occurrence_index = data.occurrences_map.get(occurrence_id);
          if (occurrence_index !== undefined) {
            if (!data.occurrences_participants[occurrence_index].includes(occurrence_id)) {
              data.users_applications &&
                (() => {
                  const user_index = data.users_map.get(user_id);
                  if (user_index !== undefined && data.users_applications[user_index]) {
                    if (!data.users_applications[user_index].includes(occurrence_id)) {
                      data.users_applications[user_index].push(occurrence_id);
                    }
                  }
                })();
            }
            data.occurrences_participants[occurrence_index].push(user_id);
            data.occurrences_participants_role[occurrence_index].push(role_id);
            data.occurrences_participants_status[occurrence_index].push(PARTICIPATION_REQUESTED);
          }
        }
        break;
      }

      case Api.OCCURRENCES_PARTICIPANTS_STATUS: {
        if (mode === Api.UPDATE) {
          const occurrence_id = Io.readInt32(reader);
          const user_id       = Io.readInt32(reader);
          const role_id       = Io.readInt32(reader);
          const status        = Io.readInt32(reader);
          const occurrence_index = data.occurrences_map.get(occurrence_id);
          if (occurrence_index !== undefined) {
            const participants = data.occurrences_participants[occurrence_index];
            const roles        = data.occurrences_participants_role[occurrence_index];
            const statuses     = data.occurrences_participants_status[occurrence_index];
            for (let i = 0; i < participants.length; i++) {
              if (participants[i] === user_id && roles[i] === role_id) {
                statuses[i] = status;
              }
            }
          }
        }
        break;
      }

      case Api.EMPLOYEES_LIMIT: {
        if (mode === Api.UPDATE) {
          data.employees_limit = Io.readInt32(reader);
        }
        break;
      }

      case Api.PUBLIC_KEY: {
        const public_key_bytes = Io.readBytes(reader);
        public_key = await crypto.subtle.importKey(
          "spki",
          public_key_bytes,
          {
            name: "RSA-OAEP",
            hash: "SHA-256",
          },
          true,
          ["encrypt"]
        );
        break;
      }

      default:
        console.warn('[waitForUpdate] unhandled field_identifier:', field_identifier);
        break;
    }
  } catch(e) {
    console.error('failed to update data', e);
  }

  try {
    if (zones[zones_identifier.VIEW_TYPE].selection == elements.calendar_button) {
      Calendar.update();
    } else {
      StaffInformation.update();
      EventInformation.update();
    }
  } catch(e) {
    console.error('failed to update ui');
  }

  waitForUpdate();
}

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
  if (dataevents_duration != null) storeValue(data.events_duration, index, -1);
}

export function deleteEvent(id) {
  const event_index = Global.data.events_map.get(id);
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
  deleteValue(data.events_map, data.events_free_list, identifier);
}

export function deleteVenue(id) {
  if(data.venue_map != null) deleteValue(data.venues_map, data.venues_free_list, id);
  if(data.events_venues != null) removeAllOf(data.events_venues, id);
}

export function updateUsersDutyStation(user_id, center_id) {
  let user_index = -1;
  if (data.users_map != null) users_index = data.users_map.get(user_id);
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
  storeValue(data.occurrences_participants,         index, []);
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

