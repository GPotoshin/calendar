import { token } from './login.js';
import { BufferWriter } from './io.js';

export const CREATE  = 0;
export const REQUEST = 1;
export const DELETE  = 2;
export const UPDATE  = 3;

export const USERS_ID_MAP_ID          = 0;
export const USERS_NAME_ID            = 1;
export const USERS_SURNAME_ID         = 2;
export const USERS_MAIL_ID            = 3;
export const USERS_PHONE_ID           = 4;
export const USERS_COMPETENCES_ID     = 5;
export const USERS_DUTY_STATION_ID    = 6;
export const USERS_PRIVILEGE_LEVEL_ID = 7;

export const EVENTS_ID_MAP_ID            = 8;
export const EVENTS_NAME_ID              = 9;
export const EVENTS_VENUE_ID             = 10;
export const EVENTS_ROLE_ID              = 11;
export const EVENTS_ROLES_REQUIREMENT_ID = 12;
export const EVENTS_PERSONAL_NUM_MAP_ID  = 13;
export const EVENTS_DURATION_ID          = 14;

export const VENUES_ID_MAP_ID = 15;
export const VENUES_NAME_ID   = 16;

export const COMPETENCES_ID_MAP_ID = 17;
export const COMPETENCES_NAME_ID   = 18;

export const ROLES_ID_MAP_ID = 19;
export const ROLES_NAME_ID   = 20;

export const OCCURRENCES_ID_MAP_ID            = 21;
export const OCCURRENCES_VENUE_ID             = 22;
export const OCCURRENCES_DATES_ID             = 23;
export const OCCURRENCES_PARTICIPANT_ID       = 24;
export const OCCURRENCES_PARTICIPANTS_ROLE_ID = 25;

export const EMPLOYEES_LIMIT_ID = 26;

export const STATE_FIELD_COUNT = 27;

export function writeHeader(w, op, stateField) {
  w.writeString("bin_api.v0.0.0");
  w.writeHash(token);
  w.writeInt32(op);
  w.writeInt32(stateField);
}

export function createBufferWriter(op, stateField) {
  let w = new BufferWriter();
  writeHeader(w, op, stateField);
  return w;
}

export function request(w) {
  return fetch('/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: w.getBuffer(),
  });
}
