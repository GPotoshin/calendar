function storeValue(array, freeList, value) {
  if (freeList.length > 0) {
    const index = freeList.pop();
    array[index] = value;
    return index;
  } else {
    array.push(value);
    return array.length - 1;
  }
}

function deleteValue(array, freeList, index) {
  if (array[index] === null) {
    return;
  }
  array[index] = null;
  freeList.push(index);
}

function deleteOccurences(array, value) {
  for (let i = 0; i < array.length; i++) {
    array[i] = array[i].filter(
      arrayValue => arrayValue !== value
    );
  }
}

function getAll(array) {
  const retval = [];
  for (let i = 0; i < array.length; i++) {
    if (array[i] !== null) {
      retval.push({idx: i, val: array[i]});
    }
  }
  return retval;
}

export class DataManager {
  constructor() {
    // Users Data
    this.usersId = new Map();
    this.usersName = [];
    this.usersSurname = [];
    this.usersMail = [];
    this.usersPhone = [];
    this.usersCompetences = [];
    this.usersDutyStation = [];
    this.usersPrivilageLevel = [];

    // Events Data
    this.eventsId = new Map();
    this.eventsName = [];
    this.eventsVenue = [];
    this.eventsRole = [];
    this.eventsRolesRequirement = [];
    this.eventsPersonalNumMap = [];
    this.eventsDuration = [];

    this.venuesId = new Map();
    this.venuesName = [];

    this.competencesId = new Map();
    this.competencesName = [];

    this.rolesId = new Map();
    this.rolesName = [];

    this.occurrencesId = new Map();
    this.occurrencesVenue = [];
    this.occurrencesDates = [];
    this.occurrencesParticipant = [];
    this.occurrencesParticipantsRole = [];
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
