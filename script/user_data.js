import * as Io from './io.js';

export class UserData {
  constructor() {
    this.matricule = -1;
    this.name = "";
    this.surname = "";
    this.mail = "";
    this.phone = "";
    this.competences = []
    this.duty_station = -1;
    this.applications = [];
    this.applications_roles = [];

    this.events_map = new Map();
    this.events_name = [];
    this.events_venues = [];
    this.events_roles = [];
    this.events_duration = [];
    this.events_free_list = [];

    this.venues_map = new Map();
    this.venues_name = [];
    this.venuse_free_list = [];

    this.occurrences_map = new Map();
    this.occurrences_event_identifier = [];
    this.occurrences_venue = [];
    this.occurrences_dates = [];
    this.occurrences_free_list = [];
    
    this.base_day_number = -1;
    this.day_occurrences = [];
  }

  read(r) {
    const expected_version = "usr_data.v0.0.3";
    const actual_version = Io.readString(r);
    if (expected_version !== actual_version) {
      throw new Error(`Format mismatch. Found: ${actual_version}, Expected: ${expected_version}`);
    }

    this.matricule = Io.readInt32(r);
    this.name = Io.readString(r);
    this.surname = Io.readString(r);
    this.mail = Io.readString(r);
    this.phone = Io.readInt32(r);
    this.competences = Io.readInt32Array(r);
    this.duty_station = Io.readInt32(r);
    this.applications = Io.readInt32Array(r);
    this.applications_roles = Io.readArrayOfInt32Arrays(r);

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
    this.occurrences_participants_role = Io.readArrayOfInt32Arrays(r);
    this.occurrences_participants_status = Io.readArrayOfInt32Arrays(r);

    this.base_day_number = Io.readInt32(r);
    this.day_occurrences = Io.readArrayOfInt32Arrays(r);
  }
}
