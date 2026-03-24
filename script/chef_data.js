import * as Io from './io.js';

export class ChefData {
  constructor() {
    this.users_map = new Map();
    this.users_name = [];
    this.users_surname = [];
    this.users_mail = [];
    this.users_phone = [];
    this.users_competences = [];
    this.users_applications = [];
    this.users_free_list = [];
    
    this.events_map = new Map();
    this.events_name = [];
    this.events_venues = [];
    this.events_roles = [];
    this.events_roles_requirements = [];
    this.events_staff_number_map = [];
    this.events_duration = [];
    this.events_free_list = [];

    this.venues_map = new Map();
    this.venues_name = [];
    this.venues_free_list = [];

    this.competences_map = new Map();
    this.competences_name = [];
    this.competences_free_list = [];

    this.roles_map = new Map();
    this.roles_name = [];
    this.roles_free_list = [];

    this.occurrences_map = new Map();
    this.occurrences_event_identifier = [];
    this.occurrences_venue = [];
    this.occurrences_dates = [];
    this.occurrences_participants = []
    this.occurrences_participants_role = [];
    this.occurrences_participants_status = [];
    this.occurrences_free_list = [];

    this.base_day_number = -1;
    this.day_occurrences = [];
  }

  read(r) {
    const expected_version = "chf_data.v0.0.2";
    const actual_version = Io.readString(r);
    if (expected_version !== actual_version) {
      throw new Error(`Format mismatch. Found: ${actual_version}, Expected: ${expected_version}`);
    }

    const selectedLen = Io.readInt32(r);
    this.users_map = new Map();
    for (let i = 0; i < selectedLen; i++) {
      const id = Io.readInt32(r);
      const idx = Io.readInt32(r);
      this.users_map.set(id, idx);
    }

    this.users_name = Io.readStringArray(r);
    this.users_surname = Io.readStringArray(r);
    this.users_mail = Io.readStringArray(r);
    this.users_phone = Io.readInt32Array(r);
    this.users_competences = Io.readArrayOfInt32Arrays(r);
    this.users_applications = Io.readArrayOfInt32Arrays(r);

    this.events_map = Io.readMapInt32Int(r);
    this.events_name = Io.readStringArray(r);
    this.events_venues = Io.readArrayOfInt32Arrays(r);
    this.events_roles = Io.readArrayOfInt32Arrays(r);
    this.events_roles_requirements = Io.readArrayOfArrayOfInt32Arrays(r);
    this.events_staff_number_map = Io.readArrayOfArrayOfInt32Arrays(r);
    this.events_duration = Io.readInt32Array(r);

    this.venues_map = Io.readMapInt32Int(r);
    this.venues_name = Io.readStringArray(r);

    this.competences_map = Io.readMapInt32Int(r);
    this.competences_name = Io.readStringArray(r);

    this.roles_map = Io.readMapInt32Int(r);
    this.roles_name = Io.readStringArray(r);

    this.occurrences_map = Io.readMapInt32Int(r);
    this.occurrences_event_identifier = Io.readInt32Array(r);
    this.occurrences_venue = Io.readInt32Array(r);
    this.occurrences_dates = Io.readArrayOfInt32PairArrays(r); 
    this.occurrences_participants = Io.readArrayOfInt32Arrays(r);
    this.occurrences_participants_role = Io.readArrayOfInt32Arrays(r);
    this.occurrences_participants_status = Io.readArrayOfInt32Arrays(r);

    this.base_day_number = Io.readInt32(r);
    this.day_occurrences = Io.readArrayOfInt32Arrays(r);
  }
}
