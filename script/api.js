export const Op = Object.freeze({
    CREATE:  0,
    REQUEST: 1,
    DELETE:  2,
    UPDATE:  3
});

const StateField = Object.freeze({
    USERS_ID_MAP_ID: 0,
    USERS_NAME_ID: 1,
    USERS_SURNAME_ID: 2,
    USERS_MAIL_ID: 3,
    USERS_PHONE_ID: 4,
    USERS_COMPETENCES_ID: 5,
    USERS_DUTY_STATION_ID: 6,
    USERS_PRIVILEGE_LEVEL_ID: 7,

    EVENTS_ID_MAP_ID: 8,
    EVENTS_NAME_ID: 9,
    EVENTS_VENUE_ID: 10,
    EVENTS_ROLE_ID: 11,
    EVENTS_ROLES_REQUIREMENT_ID: 12,
    EVENTS_PERSONAL_NUM_MAP_ID: 13,
    EVENTS_DURATION_ID: 14,

    VENUES_ID_MAP_ID: 15,
    VENUES_NAME_ID: 16,

    COMPETENCES_ID_MAP_ID: 17,
    COMPETENCES_NAME_ID: 18,

    ROLES_ID_MAP_ID: 19,
    ROLES_NAME_ID: 20,

    OCCURRENCES_ID_MAP_ID: 21,
    OCCURRENCES_VENUE_ID: 22,
    OCCURRENCES_DATES_ID: 23,
    OCCURRENCES_PARTICIPANT_ID: 24,
    OCCURRENCES_PARTICIPANTS_ROLE_ID: 25,

    STATE_FIELD_COUNT: 26
});

export function writeHeader(w, token, op, stateField) {
  w.writeString("bin_api.v.0.0.0");
  w.writeHash(token);
  w.writeInt32(op);
  w.writeInt32(stateField);
}

export function writeCreateMapEntry(w, name) {
  w.writeString(name)
}
