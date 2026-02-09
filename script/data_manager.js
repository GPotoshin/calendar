export function storageIndex(map, free_list) {
  if (free_list.length > 0) {
    return free_list.pop();
  } else {
    return map.size;
  }
}

export const newId = storageIndex;

export function storeValue(array, index, value) {
  if (index >= 0 && index < array.length) {
    array[index] = value;
  } else {
    array.push(value);
  }
}

export function deleteValue(map, free_list, identifier) {
  const index = map.get(identifier);
  if (index !== undefined) {
    free_list.push(index);
    map.delete(identifier);
  }
}

export function rebaseMap(map, free_list) {
  for (let [key, index] of map.entries()) {
    let count = 0;
    while (count < free_list.length && free_list[count] < index) {
      count++;
    }
    map.set(key, index - count);
  }
}

export function shrinkArray(array, free_list) {
  for (let i = 0; i < freeList.length; i++) {
    let limit;
    if (i === free_list.length-1) {
      limit = array.length-1-i;
    } else {
      limit = free_list[i+1]-1-i;
    }

    for (let j = free_list[i]-i; j < limit; j++) {
      array[j] = array[j+1+i];
    }
  }

  array.length = array.length - free_list.length;
}

export function deleteOccurrences(array, value) {
  for (let i = 0; i < array.length; i++) {
    array[i] = array[i].filter(array_value => array_value !== value);
  }
}

export class DataManager {
  constructor() {
    this.users_identifier = new Map();
    this.users_name = [];
    this.users_surname = [];
    this.users_mail = [];
    this.users_phone = [];
    this.users_competences = [];
    this.users_duty_station = [];
    this.users_privilage_level = [];
    this.users_free_list = [];

    this.events_identifier = new Map();
    this.events_name = [];
    this.events_venues = [];
    this.events_roles = [];
    this.events_roles_requirements = [];
    this.events_staff_numeric_map = [];
    this.events_duration = [];
    this.events_free_list = [];

    this.venues_identifier = new Map();
    this.venues_name = [];
    this.venues_free_list = [];

    this.competences_identifier = new Map();
    this.competences_name = [];
    this.competencesFreeId = [];
    this.competences_free_list = [];

    this.roles_idetifier = new Map();
    this.roles_name = [];
    this.roles_free_list = [];

    this.occurrences_identifier = new Map();
    this.occurrences_venue = [];
    this.occurrences_dates = [];
    this.occurrences_participants = [];
    this.occurrences_participantssRole = [];
    this.occurrences_free_list = [];

    this.base_day_number = [];
    this.day_occurrences = [];

    this.employees_limit = -1;
  }

  read(r) {
    const expected_version = "admin_data.v0.0.5";
    const actual_version = r.readString();
    
    if (expected_version !== actual_version) {
      throw new Error(`Format mismatch. Found: ${actual_version}, Expected: ${expected_version}`);
    }

    this.users_identifier = r.readMapInt32Int();
    this.users_name = r.readStringArray();
    this.users_surname = r.readStringArray();
    this.users_mail = r.readStringArray();
    this.users_phone = r.readInt32Array();
    this.users_competences = r.readArrayOfInt32Arrays();
    this.users_duty_station = r.readInt32Array();
    this.users_privilage_level = r.readInt32Array();

    this.events_identifier = r.readMapInt32Int();
    this.events_name = r.readStringArray();
    this.events_venues = r.readArrayOfInt32Arrays();
    this.events_roles = r.readArrayOfInt32Arrays();
    this.events_roles_requirements = r.readArrayOfArrayOfInt32Arrays();
    this.events_staff_numeric_map = r.readArrayOfArrayOfInt32Arrays();
    this.events_duration = r.readInt32Array();

    this.venues_identifier = r.readMapInt32Int();
    this.venues_name = r.readStringArray();

    this.competences_identifier = r.readMapInt32Int();
    this.competences_name = r.readStringArray();

    this.roles_idetifier = r.readMapInt32Int();
    this.roles_name = r.readStringArray();

    this.occurrences_identifier = r.readMapInt32Int();
    this.occurrences_venue = r.readInt32Array();
    this.occurrences_dates = r.readArrayOfInt32PairArrays(); 
    this.occurrences_participants = r.readArrayOfInt32Arrays();
    this.occurrences_participantssRole = r.readArrayOfInt32Arrays();

    this.base_day_number = r.readInt32();
    this.day_occurrences = r.readArrayOfInt32Arrays();

    this.employees_limit = r.readInt32();
  }

  bundleEventsNames() {
    return {
      map: this.events_identifier,
      array: this.events_name,
      free_list: this.events_free_list,
    };
  }
  bundleVenuesNames() {
    return {
      map: this.venues_identifier,
      array: this.venues_name,
      free_list: this.venues_free_list,
    };
  }
  bundleRolesNames() {
    return {
      map: this.roles_idetifier,
      array: this.roles_name,
      free_list: this.roles_free_list,
    };
  }
}
