import * as Io from './io.js';

export class AdminData {
  constructor() {
    this.users_map = new Map();
    this.users_name = [];
    this.users_surname = [];
    this.users_mail = [];
    this.users_phone = [];
    this.users_competences = [];
    this.users_duty_station = [];
    this.users_privilege_level = [];
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
    this.competencesFreeId = [];
    this.competences_free_list = [];

    this.roles_map = new Map();
    this.roles_name = [];
    this.roles_free_list = [];

    this.occurrences_map = new Map();
    this.occurrences_event_identifiers = [];
    this.occurrences_venue = [];
    this.occurrences_dates = [];
    this.occurrences_participants = [];
    this.occurrences_participantssRole = [];
    this.occurrences_free_list = [];

    this.base_day_number = -1;
    this.day_occurrences = [];

    this.employees_limit = -1;
  }

  read(r) {
    const expected_version = "adm_data.v0.0.6";
    const actual_version = Io.readString(r);
    
    if (expected_version !== actual_version) {
      throw new Error(`Format mismatch. Found: ${actual_version}, Expected: ${expected_version}`);
    }

    this.users_map = Io.readMapInt32Int(r);
    this.users_name = Io.readStringArray(r);
    this.users_surname = Io.readStringArray(r);
    this.users_mail = Io.readStringArray(r);
    this.users_phone = Io.readInt32Array(r);
    this.users_competences = Io.readArrayOfInt32Arrays(r);
    this.users_duty_station = Io.readInt32Array(r);
    this.users_privilege_level = Io.readInt32Array(r);

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
    this.occurrences_event_identifiers = Io.readInt32Array(r);
    this.occurrences_venue = Io.readInt32Array(r);
    this.occurrences_dates = Io.readArrayOfInt32PairArrays(r); 
    this.occurrences_participants = Io.readArrayOfInt32Arrays(r);
    this.occurrences_participantssRole = Io.readArrayOfInt32Arrays(r);

    this.base_day_number = Io.readInt32(r);
    this.day_occurrences = Io.readArrayOfInt32Arrays(r);

    this.employees_limit = Io.readInt32(r);
  }

  bundleCompetencesNames() {
    return {
      map: this.competences_map,
      array: this.competences_name,
      free_list: this.competences_free_list,
    };
  }
  bundleEventsNames() {
    return {
      map: this.events_map,
      array: this.events_name,
      free_list: this.events_free_list,
    };
  }
  bundleVenuesNames() {
    return {
      map: this.venues_map,
      array: this.venues_name,
      free_list: this.venues_free_list,
    };
  }
  bundleRolesNames() {
    return {
      map: this.roles_map,
      array: this.roles_name,
      free_list: this.roles_free_list,
    };
  }
}
