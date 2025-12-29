export function storageIndex(map, freeList) {
  if (freeList.length > 0) {
    return freeList.pop();
  } else {
    return map.size;
  }
}

export function storeValue(array, idx, value) {
  if (idx >= 0 && idx < array.length) {
    array[idx] = value;
  } else {
    array.push(value);
  }
}

export function deleteValue(map, freeList, id) {
  const idx = map.get(id);
  if (idx !== undefined) {
    freeList.push(idx);
    map.delete(id);
  }
}

export function rebaseMap(map, freeList) {
  for (let [key, idx] of map.entries()) {
    let count = 0;
    while (count < freeList.length && freeList[count] < idx) {
      count++;
    }
    map.set(key, idx - count);
  }
}

export function shrinkArray(a, freeList) {
  for (let i = 0; i < freeList.length; i++) {
    let limit;
    if (i === freeList.length-1) {
      limit = a.length-1-i;
    } else {
      limit = freeList[i+1]-1-i;
    }

    for (let j = freeList[i]-i; j < limit; j++) {
      a[j] = a[j+1+i];
    }
  }

  a.length = a.length - freeList.length;
}

export function deleteOccurrences(array, value) {
  for (let i = 0; i < array.length; i++) {
    array[i] = array[i].filter(arrayValue => arrayValue !== value);
  }
}
export class DataManager {
  constructor() {
    this.usersId = new Map();
    this.usersName = [];
    this.usersSurname = [];
    this.usersMail = [];
    this.usersPhone = [];
    this.usersCompetences = [];
    this.usersDutyStation = [];
    this.usersPrivilageLevel = [];
    this.usersFreeList = [];

    this.eventsId = new Map();
    this.eventsName = [];
    this.eventsVenue = [];
    this.eventsRole = [];
    this.eventsRolesRequirement = [];
    this.eventsPersonalNumMap = [];
    this.eventsDuration = [];
    this.eventsFreeList = [];

    this.venuesId = new Map();
    this.venuesName = [];
    this.venuesFreeList = [];

    this.competencesId = new Map();
    this.competencesName = [];
    this.competencesFreeList = [];

    this.rolesId = new Map();
    this.rolesName = [];
    this.rolesFreeList = [];

    this.occurrencesId = new Map();
    this.occurrencesVenue = [];
    this.occurrencesDates = [];
    this.occurrencesParticipant = [];
    this.occurrencesParticipantsRole = [];
    this.occurrencesFreeList = [];
  }

  read(reader) {
    const expectedVersion = "admin_data.v0.0.1";
    const actualVersion = reader.readString();
    
    if (expectedVersion !== actualVersion) {
      throw new Error(`Format mismatch. Found: ${actualVersion}, Expected: ${expectedVersion}`);
    }

    this.usersId = reader.readMapInt32Int();
    this.usersName = reader.readStringArray();
    this.usersSurname = reader.readStringArray();
    this.usersMail = reader.readStringArray();
    this.usersPhone = reader.readInt32Array();
    this.usersCompetences = reader.readArrayOfInt32Arrays();
    this.usersDutyStation = reader.readInt32Array();
    this.usersPrivilageLevel = reader.readInt32Array();

    this.eventsId = reader.readMapInt32Int();
    this.eventsName = reader.readStringArray();
    this.eventsVenue = reader.readArrayOfInt32Arrays();
    this.eventsRole = reader.readArrayOfInt32Arrays();
    this.eventsRolesRequirement = reader.readArrayOfArrayOfInt32Arrays();
    this.eventsPersonalNumMap = reader.readArrayOfArrayOfInt32Arrays();
    this.eventsDuration = reader.readInt32Array();

    this.venuesId = reader.readMapInt32Int();
    this.venuesName = reader.readStringArray();

    this.competencesId = reader.readMapInt32Int();
    this.competencesName = reader.readStringArray();

    this.rolesId = reader.readMapInt32Int();
    this.rolesName = reader.readStringArray();

    this.occurrencesId = reader.readMapInt32Int();
    this.occurrencesVenue = reader.readInt32Array();
    this.occurrencesDates = reader.readArrayOfInt32PairArrays(); 
    this.occurrencesParticipant = reader.readArrayOfInt32Arrays();
    this.occurrencesParticipantsRole = reader.readArrayOfInt32Arrays();
  }
}
