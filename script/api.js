import { token } from './login.js';
import * as Io from './io.js';

export const CREATE  = 0;
export const REQUEST = 1;
export const DELETE  = 2;
export const UPDATE  = 3;

export const USERS_MAP             = 0;
export const USERS_NAME            = 1;
export const USERS_SURNAME         = 2;
export const USERS_MAIL            = 3;
export const USERS_PHONE           = 4;
export const USERS_COMPETENCES     = 5;
export const USERS_DUTY_STATION    = 6;
export const USERS_PRIVILEGE_LEVEL = 7;

export const EVENTS_MAP               = 8;
export const EVENTS_NAME              = 9;
export const EVENTS_VENUE             = 10;
export const EVENTS_ROLE              = 11;
export const EVENTS_ROLES_REQUIREMENT = 12;
export const EVENTS_PERSONAL_NUM_MAP  = 13;
export const EVENTS_DURATION          = 14;

export const VENUES_MAP  = 15;
export const VENUES_NAME = 16;

export const COMPETENCES_MAP  = 17;
export const COMPETENCES_NAME = 18;

export const ROLES_MAP  = 19;
export const ROLES_NAME = 20;

export const OCCURRENCES_MAP               = 21;
export const OCCURRENCES_VENUE             = 22;
export const OCCURRENCES_DATES             = 23;
export const OCCURRENCES_PARTICIPANT       = 24;
export const OCCURRENCES_PARTICIPANTS_ROLE = 25;

export const EMPLOYEES_LIMIT = 26;

export const STATE_FIELD_COUNT = 27;

export function writeHeader(writer, operation_identifier, field_identifier) {
  Io.writeString(writer, "bin_api.v0.0.0");
  Io.writeHash(writer, token);
  Io.writeInt32(writer, operation_identifier);
  Io.writeInt32(writer, field_identifier);
}

export function createBufferWriter(operation_identifier, field_identifier) {
  let writer = new Io.BufferWriter();
  writeHeader(writer, operation_identifier, field_identifier);
  return writer;
}

export function request(writer) {
  return fetch('/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  });
}
