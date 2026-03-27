import {storeValue, deleteValue, removeAllOf, storageIndex} from './data_manager.js';
import * as Io from './io.js';
import * as Calendar from './calendar.js';
import * as Api from './api.js';
import * as StaffInformation from './staff_information.js';
import * as EventInformation from './event_information.js';
import * as SideMenu from './side_menu.js';
import * as Global from './global.js';

const abort_controller =  new AbortController();
export async function waitForUpdate() {
  while (true) {
    try {
      const writer = new Io.BufferWriter();
      Io.writeHash(writer, Global.token);

      const response = await fetch('/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: writer.getBuffer(),
        signal: abort_controller.signal,
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
              Global.createUser(mat, name, surename);
              SideMenu.addUserButton(name, surename, mat);
              break;
            }
            case Api.UPDATE: {
              const new_mat = Io.readInt32(reader);
              const name    = Io.readString(reader);
              const surname = Io.readString(reader);
              Global.updateUser(mat, new_mat, name, surname);
              SideMenu.removeButtonFromZone(Global.zones_identifier.STAFF, id);
              break;
            }
            case Api.DELETE: {
              Global.deleteUser(mat);
              break;
            }
          }
          break;
        }

        case Api.USERS_DUTY_STATION: {
          const user_id    = Io.readInt32(reader);
          const center_id  = Io.readInt32(reader);
          Global.updateUsersDutyStation(user_id, center_id)
          break;
        }

        case Api.USERS_PRIVILEGE_LEVEL: {
          const mat = Io.readInt32(reader);
          const p_level = Io.readInt32(reader);
          Global.updateUserPrivilegeLevel(mat, p_level);
          break;
        }

        case Api.EVENTS_MAP: {
          switch (mode) {
            case Api.CREATE: {
              const id = Io.readInt32(reader);
              const name = Io.readString(reader);
              Global.createEvent(id, name);
              SideMenu.addButtonToZone(Global.zones_identifier.EVENT, name, id);
              break;
            }
            case Api.DELETE: {
              const id = Io.readInt32(reader);
              Global.deleteEvent(id);
              SideMenu.removeButtonFromZone(Global.zones_identifier.EVENT, id);
              break;
            }
            case Api.UPDATE: { // leaving it as right now
              const id       = Io.readInt32(reader);
              const new_name = Io.readString(reader);
              const index = Global.data.events_map.get(id);
              if (index !== undefined) {
                Global.data.events_name[index] = new_name;
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
              Global.createEventsRole(event_id, role_id);
              break;
            }
            case Api.DELETE: {
              Global.deleteEventsRole(event_id, role_id)
              break;
            }
          }
          break;
        }

        case Api.EVENTS_ROLES_REQUIREMENT: {
          const event_identifier     = Io.readInt32(reader);
          const role_ordinal         = Io.readInt32(reader);
          const competence_identifier = Io.readInt32(reader);
          const event_index = Global.data.events_map.get(event_identifier);
          if (event_index === undefined) return;
          const requirements = Global.data.events_roles_requirements[event_index][role_ordinal];
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
          const event_index = Global.data.events_map.get(event_identifier);
          if (event_index === undefined) return;
          switch (mode) {
            case Api.CREATE: {
              const row_data = Io.readInt32Array(reader);
              Global.data.events_staff_number_map[event_index].push(row_data);
              break;
            }
            case Api.DELETE: {
              const line_index = Io.readInt32(reader);
              Global.data.events_staff_number_map[event_index].splice(line_index, 1);
              break;
            }
            case Api.UPDATE: {
              const line_index = Io.readInt32(reader);
              const num_index  = Io.readInt32(reader);
              const val        = Io.readInt32(reader);
              Global.data.events_staff_number_map[event_index][line_index][num_index] = val;
              break;
            }
          }
          break;
        }

        case Api.EVENTS_DURATION: {
          const event_identifier = Io.readInt32(reader);
          const duration         = Io.readInt32(reader);
          const event_index = Global.data.events_map.get(event_identifier);
          if (event_index !== undefined) {
            Global.data.events_duration[event_index] = duration;
          }
          break;
        }

        case Api.VENUES_MAP: {
          switch (mode) {
            case Api.CREATE: {
              const id = Io.readInt32(reader);
              const name = Io.readString(reader);
              Global.createVenue(id, name);
              SideMenu.addButtonToZone(Global.zones_identifier.VENUE, name, id);
              break;
            }
            case Api.DELETE: {
              const id = Io.readInt32(reader);
              Global.deleteVenue(id);
              SideMenu.removeButtonFromZone(Global.zones_identifier.VENUE, id);
              break;
            }
            case Api.UPDATE: {
              const id       = Io.readInt32(reader);
              const new_name = Io.readString(reader);
              const index = Global.data.venues_map.get(id);
              if (index !== undefined) {
                Global.data.venues_name[index] = new_name;
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
              Global.createCompetence(id, name);
              break;
            }
            case Api.DELETE: {
              const id = Io.readInt32(reader);
              deleteValue(Global.data.competences_map, Global.data.competences_free_list, id);
              for (const [, event_index] of Global.data.events_map) {
                removeAllOf(Global.data.events_roles_requirements[event_index], id);
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
              Global.createRole(new_id, name);
              break;
            }
            case Api.DELETE: {
              const id = Io.readInt32(reader);
              deleteValue(Global.data.roles_map, Global.data.roles_free_list, id);
              removeAllOf(Global.data.events_roles, id);
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
              const intervals = Io.readInt32PairArray(reader);

              Global.createOccurrence(id, event_id, intervals);
              Global.pushToDayOccurrences(intervals, id);
              Calendar.renderBars();
              break;
            }
            case Api.DELETE: {
              const occurrence_id = Io.readInt32(reader); // @error
              const occurrence_index = Global.data.occurrences_map.get(occurrence_id);
              if (occurrence_index !== undefined) {
                Global.removeFromDayOccurrences(occurrence_id, occurrence_index);
                deleteValue(Global.data.occurrences_map, Global.data.occurrences_free_list, occurrence_id);
                Calendar.renderBars();
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
            const index = Global.data.occurrences_map.get(identifier);
            if (index !== undefined) {
              // remove old entries from day_occurrences
              for (const interval of Global.data.occurrences_dates[index]) {
                const start = interval[0] - Global.data.base_day_number;
                const end   = interval[1] - Global.data.base_day_number;
                for (let i = start; i <= end; i++) {
                  if (Global.data.day_occurrences[i]) {
                    Global.data.day_occurrences[i] = Global.data.day_occurrences[i].filter(v => v !== identifier);
                  }
                }
              }
              // add new entries
              for (const interval of intervals) {
                const start = Math.max(interval[0] - Global.data.base_day_number, 0);
                const end   = Math.min(interval[1] - Global.data.base_day_number, Global.data.day_occurrences.length - 1);
                for (let i = start; i <= end; i++) {
                  if (!Global.data.day_occurrences[i]) Global.data.day_occurrences[i] = [];
                  Global.data.day_occurrences[i].push(identifier);
                }
              }
              Global.data.occurrences_dates[index] = intervals;
            }
          }
          break;
        }

        case Api.OCCURRENCES_PARTICIPANT: {
          if (mode === Api.CREATE) {
            const occurrence_id = Io.readInt32(reader);
            const user_id       = Io.readInt32(reader);
            const role_id       = Io.readInt32(reader);
            const occurrence_index = Global.data.occurrences_map.get(occurrence_id);
            if (occurrence_index !== undefined) {
              if (!Global.data.occurrences_participants[occurrence_index].includes(occurrence_id)) {
                Global.data.users_applications &&
                  (() => {
                    const user_index = Global.data.users_map.get(user_id);
                    if (user_index !== undefined && Global.data.users_applications[user_index]) {
                      if (!Global.data.users_applications[user_index].includes(occurrence_id)) {
                        Global.data.users_applications[user_index].push(occurrence_id);
                      }
                    }
                  })();
              }
              Global.data.occurrences_participants[occurrence_index].push(user_id);
              Global.data.occurrences_participants_role[occurrence_index].push(role_id);
              Global.data.occurrences_participants_status[occurrence_index].push(PARTICIPATION_REQUESTED);
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
            const occurrence_index = Global.data.occurrences_map.get(occurrence_id);
            if (occurrence_index !== undefined) {
              const participants = Global.data.occurrences_participants[occurrence_index];
              const roles        = Global.data.occurrences_participants_role[occurrence_index];
              const statuses     = Global.data.occurrences_participants_status[occurrence_index];
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
            Global.data.employees_limit = Io.readInt32(reader);
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
      if (e.name === 'AbortError') return;
      console.error('failed to update data', e);
    }

    try {
      if (Global.zones[Global.zones_identifier.VIEW_TYPE].selection == Global.elements.calendar_button) {
        Calendar.update();
      } else {
        StaffInformation.update();
        EventInformation.update();
      }
    } catch(e) {
      console.error('failed to update ui');
    }
  }
}

window.addEventListener('beforeunload', () => {
  abort_controller.abort();
});
