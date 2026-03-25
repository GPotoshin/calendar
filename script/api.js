import { token } from './login.js';
import * as Io from './io.js';

export const CREATE  = 0;
export const REQUEST = 1;
export const DELETE  = 2;
export const UPDATE  = 3;

export const USERS_MAP             = 0;
export const USERS_PASSWORD        = 1;
export const USERS_NAME            = 2;
export const USERS_SURNAME         = 3;
export const USERS_MAIL            = 4;
export const USERS_PHONE           = 5;
export const USERS_COMPETENCES     = 6;
export const USERS_DUTY_STATION    = 7;
export const USERS_PRIVILEGE_LEVEL = 8;

export const EVENTS_MAP               = 9;
export const EVENTS_NAME              = 10;
export const EVENTS_VENUE             = 11;
export const EVENTS_ROLE              = 12;
export const EVENTS_ROLES_REQUIREMENT = 13;
export const EVENTS_PERSONAL_NUM_MAP  = 14;
export const EVENTS_DURATION          = 15;

export const VENUES_MAP  = 16;
export const VENUES_NAME = 17;

export const COMPETENCES_MAP  = 18;
export const COMPETENCES_NAME = 19;

export const ROLES_MAP  = 20;
export const ROLES_NAME = 21;

export const OCCURRENCES_MAP                 = 22;
export const OCCURRENCES_VENUE               = 23;
export const OCCURRENCES_DATES               = 24;
export const OCCURRENCES_PARTICIPANT         = 25;
export const OCCURRENCES_PARTICIPANTS_ROLE   = 26;
export const OCCURRENCES_PARTICIPANTS_STATUS = 27;

export const EMPLOYEES_LIMIT = 28;
export const PUBLIC_KEY = 29;
export const STATE_FIELD_COUNT = 30;

export function writeHeader(writer, operation_identifier, field_identifier) {
  if (writer == null || operation_identifier == null || field_identifier == null) {
    throw new Error("api variable is null");
  }
  Io.writeString(writer, "bin_api.v0.0.0");
  Io.writeHash(writer, token);
  Io.writeInt32(writer, field_identifier);
  Io.writeInt32(writer, operation_identifier);
}

export function createBufferWriter(operation_identifier, field_identifier) {
  if (operation_identifier == null || field_identifier == null) {
    throw new Error("api variable is null");
  }
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
