export function storageIndex(map, freeList) {
  if (freeList.length > 0) {
    return freeList.pop();
  } else {
    return map.size;
  }
}

export const newId = storageIndex;

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
    this.eventsVenues = [];
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
    this.competencesFreeId = [];
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

  read(r) {
    const expectedVersion = "admin_data.v0.0.3";
    const actualVersion = r.readString();
    
    if (expectedVersion !== actualVersion) {
      throw new Error(`Format mismatch. Found: ${actualVersion}, Expected: ${expectedVersion}`);
    }

    this.usersId = r.readMapInt32Int();
    this.usersName = r.readStringArray();
    this.usersSurname = r.readStringArray();
    this.usersMail = r.readStringArray();
    this.usersPhone = r.readInt32Array();
    this.usersCompetences = r.readArrayOfInt32Arrays();
    this.usersDutyStation = r.readInt32Array();
    this.usersPrivilageLevel = r.readInt32Array();

    this.eventsId = r.readMapInt32Int();
    this.eventsName = r.readStringArray();
    this.eventsVenues = r.readArrayOfInt32Arrays();
    this.eventsRole = r.readArrayOfInt32Arrays();
    this.eventsRolesRequirement = r.readArrayOfArrayOfInt32Arrays();
    this.eventsPersonalNumMap = r.readArrayOfArrayOfInt32Arrays();
    this.eventsDuration = r.readInt32Array();

    this.venuesId = r.readMapInt32Int();
    this.venuesName = r.readStringArray();

    this.competencesId = r.readMapInt32Int();
    this.competencesName = r.readStringArray();

    this.rolesId = r.readMapInt32Int();
    this.rolesName = r.readStringArray();

    this.occurrencesId = r.readMapInt32Int();
    this.occurrencesVenue = r.readInt32Array();
    this.occurrencesDates = r.readArrayOfInt32PairArrays(); 
    this.occurrencesParticipant = r.readArrayOfInt32Arrays();
    this.occurrencesParticipantsRole = r.readArrayOfInt32Arrays();
  }
}
