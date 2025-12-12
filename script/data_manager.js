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
      this.eventNames = [];
      this.eventStaff = [];
      this.eventVenues = [];
      this.eventPersonalNumMap = [];
      this.eventStaffDiplReq = [];
      this.eventAttendeeDiplReq = [];
      this.eventDuration = [];
      this.eventFreeList = [];

      this.staffNames = [];
      this.staffFreeList = [];
      this.venueNames = [];
      this.venueFreeList = [];

      this.staffsDiplomesNames = [];
      this.attendeesDiplomesNames = [];
  }

  storeEvent(name, staffIndices = [], venueIndices = []) {
    const idx = storeValue(this.eventNames, this.eventFreeList, name);
    this.eventStaff[idx] = staffIndices;
    this.eventVenues[idx] = venueIndices;
    return idx;
  }

  deleteEvent(idx) {
    deleteValue(this.eventNames, this.eventFreeList, idx);
    this.eventStaff[idx] = null;
    this.eventVenues[idx] = null;
  }

  storeStaff(name) {
    return storeValue(this.staffNames, this.staffFreeList, name);
  }

  deleteStaff(idx) {
    deleteValue(this.staffNames, this.staffFreeList, idx);
    deleteOccurences(this.eventStaff, idx);
  }

  storeVenue(name) {
    return storeValue(this.venueNames, this.venueFreeList, name);
  }

  deleteVenue(idx) {
    deleteValue(this.venueNames, this.venueFreeList, idx);
    deleteOccurences(this.eventVenues, idx);
  }

  getEvent(idx) {
    return {
      idx: idx,
      name: this.eventNames[idx],
      staff: this.eventStaff[idx] || [],
      venues: this.eventVenues[idx] || [],
    };
  }

  addStaffToEvent(eventIndex, staffIndex) {
    if (!this.eventStaff[eventIndex].includes(staffIndex)) {
      this.eventStaff[eventIndex].push(staffIndex);
    }
  }

  removeStaffFromEvent(eventIndex, staffIndex) {
    this.eventStaff[eventIndex] = this.eventStaff[eventIndex].filter(
      idx => idx !== staffIndex
    );
  }

  addVenueToEvent(eventIndex, venueIndex) {
    if (!this.eventVenues[eventIndex].includes(venueIndex)) {
      this.eventVenues[eventIndex].push(venueIndex);
    }
  }

  removeVenueFromEvent(eventIndex, venueIndex) {
    this.eventVenues[eventIndex] = this.eventVenues[eventIndex].filter(
      idx => idx !== venueIndex
    );
  }

  read(reader) {
    const version = "bin_state.v0.0.3"; 
    const format = reader.readString();
    
    if (version != format) {
      throw new Error(`reading format: \`${format}\`. Supporting format: \`${version}\``);
    }

    this.eventNames = reader.readStringArray();
    this.eventStaff = reader.readArrayOfInt32Arrays();
    this.eventVenues = reader.readArrayOfInt32Arrays();
    this.eventPersonalNumMap = reader.readArrayOfInt32Arrays();
    this.eventStaffDiplReq = reader.readInt32Array();
    this.eventAttendeeDiplReq = reader.readInt32Array();
    this.eventDuration = reader.readInt32Array();
    this.staffNames = reader.readStringArray();
    this.venueNames = reader.readStringArray();
    this.staffsDiplomesNames = reader.readStringArray();
    this.attendeesDiplomesNames = reader.readStringArray();
  }
}

