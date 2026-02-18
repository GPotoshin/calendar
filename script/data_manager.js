import * as Io from './io.js';

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


function sortedInsert(sorted_array, value_to_insert) {
  let low = 0, high = sorted_array.length;
  
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sorted_array[mid] < value_to_insert) low = mid + 1;
    else high = mid;
  }
  
  sorted_array.splice(low, 0, value_to_insert);
  return sorted_array;
}

export function deleteValue(map, free_list, identifier) {
  const index = map.get(identifier);
  if (index !== undefined) {
    sortedInsert(free_list, index);
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

function readEventRole(r) {
  return {
    identifer: Io.readInt32(r),
    requirements: Io.readInt32Array(r),
  };
}
function readArrayOfEventRole(r) {
  return Io.readArray(r, readEventRole);
}

export class DataManager {
  constructor() {
    this.users_identifier_to_index_map = new Map();
    this.users_name = [];
    this.users_surname = [];
    this.users_mail = [];
    this.users_phone = [];
    this.users_competences = [];
    this.users_duty_station = [];
    this.users_privilage_level = [];
    this.users_free_list = [];

    this.events_identifier_to_index_map = new Map();
    this.events_name = [];
    this.events_venues = [];
    this.events_roles = [];
    this.events_roles_requirements = [];
    this.events_staff_number_map = [];
    this.events_duration = [];
    this.events_free_list = [];

    this.venues_identifier_to_index_map = new Map();
    this.venues_name = [];
    this.venues_free_list = [];

    this.competences_identifier_to_index_map = new Map();
    this.competences_name = [];
    this.competencesFreeId = [];
    this.competences_free_list = [];

    this.roles_identifier_to_index_map = new Map();
    this.roles_name = [];
    this.roles_free_list = [];

    this.occurrences_identifier_to_index_map = new Map();
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
    const actual_version = Io.readString(r);
    
    if (expected_version !== actual_version) {
      throw new Error(`Format mismatch. Found: ${actual_version}, Expected: ${expected_version}`);
    }

    this.users_identifier_to_index_map = Io.readMapInt32Int(r);
    this.users_name = Io.readStringArray(r);
    this.users_surname = Io.readStringArray(r);
    this.users_mail = Io.readStringArray(r);
    this.users_phone = Io.readInt32Array(r);
    this.users_competences = Io.readArrayOfInt32Arrays(r);
    this.users_duty_station = Io.readInt32Array(r);
    this.users_privilage_level = Io.readInt32Array(r);

    this.events_identifier_to_index_map = Io.readMapInt32Int(r);
    this.events_name = Io.readStringArray(r);
    this.events_venues = Io.readArrayOfInt32Arrays(r);
    this.events_roles = Io.readArrayOfInt32Arrays(r);
    this.events_roles_requirements = Io.readArrayOfArrayOfInt32Arrays(r);
    this.events_staff_number_map = Io.readArrayOfArrayOfInt32Arrays(r);
    this.events_duration = Io.readInt32Array(r);

    this.venues_identifier_to_index_map = Io.readMapInt32Int(r);
    this.venues_name = Io.readStringArray(r);

    this.competences_identifier_to_index_map = Io.readMapInt32Int(r);
    this.competences_name = Io.readStringArray(r);

    this.roles_identifier_to_index_map = Io.readMapInt32Int(r);
    this.roles_name = Io.readStringArray(r);

    this.occurrences_identifier_to_index_map = Io.readMapInt32Int(r);
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
      map: this.competences_identifier_to_index_map,
      array: this.competences_name,
      free_list: this.competences_free_list,
    };
  }
  bundleEventsNames() {
    return {
      map: this.events_identifier_to_index_map,
      array: this.events_name,
      free_list: this.events_free_list,
    };
  }
  bundleVenuesNames() {
    return {
      map: this.venues_identifier_to_index_map,
      array: this.venues_name,
      free_list: this.venues_free_list,
    };
  }
  bundleRolesNames() {
    return {
      map: this.roles_identifier_to_index_map,
      array: this.roles_name,
      free_list: this.roles_free_list,
    };
  }
}
