import {
  setMonthScrollPosition,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} from './scrollable_calendar.js';

import { palette } from './color.js';
import { BufferReader, BufferWriter } from './Io.js';

let state = {
  sideMenuIsOpen: false,
  selected_element: null,
  previousScroll: 0,
  handleTyping: null,
};

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
  if (index < 0 || index >= array.length || array[index] === null) {
    throw new Error(`Invalid index: ${index}`);
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

function getAll(array, composerFn) {
  const retval = [];
  for (let i = 0; i < array.length; i++) {
    if (array[i] !== null) {
      retval.push({ idx: i, ...composerFn(array, i) });
    }
  }
  return retval;
}

class DataManager {
  constructor() {
      this.eventNames = [];
      this.eventStaff = [];
      this.eventVenues = [];
      this.eventFreeList = [];
      this.staffNames = [];
      this.staffFreeList = [];
      this.venueNames = [];
      this.venueFreeList = [];
  }

  storeEvent(name, staffIndices = [], venueIndices = []) {
    const idx = storeValue(
      this.data.eventNames, 
      this.data.eventFreeList, 
      name
    );
    
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
    return storeValue(
      this.staffNames, 
      this.staffFreeList, 
      name
    );
  }

  deleteStaff(idx) {
    deleteValue(this.staffNames, this.staffFreeList, idx);
    deleteOccurences(this.eventStaff, idx);
  }

  storeVenue(name) {
    return storeValue(
      this.venueNames, 
      this.venueFreeList, 
      name
    );
  }

  deleteVenue(idx) {
    deleteValue(this.venueNames, this.venueFreeList, idx);
    deleteOccurences(this.eventVenues, idx);
  }

  getEvent(idx) {
    if (thiseventNames[idx] === null) {
      return null;
    }
    return {
      name: this.eventNames[idx],
      staff: this.eventStaff[idx] || [],
      venues: this.eventVenues[idx] || []
    };
  }

  getStaffName(idx) {
    return this.staffNames[idx];
  }

  getVenueName(idx) {
    return this.venueNames[idx];
  }

  _composeName(arr, idx) {
    return { name: arr[idx] };
  }

  _composeEvent(arr, idx) {
    return this.getEvent(idx);
  }

  getAllEvents() {
    return getAll(this.eventNames, this._composeEvent);
  }

  getAllStaff() {
    return getAll(this.staffNames, this._composeName);
  }

  getAllVenues() {
    return getAll(this.venueNames, this._composeName);
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

  print() {
    console.log('Events:', this.eventNames);
    console.log('Event Staff:', this.eventStaff);
    console.log('Event Venues:', this.eventVenues);
    console.log('Event Free List:', this.eventFreeList);
    console.log('Staff:', this.staffNames);
    console.log('Staff Free List:', this.staffFreeList);
    console.log('Venues:', this.venueNames);
    console.log('Venue Free List:', this.venueFreeList);
  }

  read(reader) {
    this.eventNames = reader.readStringArray();
    this.eventStaff = reader.readArrayOfInt32Arrays();
    this.eventVenues = reader.readArrayOfInt32Arrays();
    this.staffNames = reader.readStringArray();
    this.venueNames = reader.readStringArray();
  }
}

const data = new DataManager();

let elements = {
  sideMenu: null,
  sideMenuContainer: null,
  createOptionMenu: null,
  nameList: null,
  venueList: null,
  rightClickMenu: null,
}

elements.sideMenu = document.createElement('div');
elements.sideMenu.classList.add('v-container');
elements.sideMenu.id = 'side-menu';

document.addEventListener('DOMContentLoaded', async (event) => {
  elements.sideMenuContainer = document.getElementById('side-menu-container');
  elements.nameList = document.getElementById('name-list');
  elements.venueList = document.getElementById('venue-list');
  elements.rightClickMenu = document.getElementById('right-click-menu');
  elements.createOptionMenu = document.getElementById('create-option-menu');

  setMonthScrollPosition();
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.addEventListener('mousedown', handleMouseDown);
  calendarBody.addEventListener('mouseup', handleMouseUp);
  calendarBody.addEventListener('mousemove', handleMouseMove);

  try {
    const response = await fetch('/data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const bin = await response.arrayBuffer();
    const r = new BufferReader(bin);
    data.read(r)
  } catch (error) {
    console.error('Could not fetch data:', error);
  }

});

document.addEventListener('click', (event) => {
  if (event.target.id == 'new-event-button') {
  // we fucking can't do that in click function because after this button
  // handling function we get immidiately a click event and that is fucking
  // retarded because this handleClickForOptionMenu function closes the menu
  // and we don't get the menu
    document.addEventListener('click', handleClickForOptionMenu);
  }
});

// @nocheckin
document.addEventListener('contextmenu', function(e) {
  const menu = elements.rightClickMenu;
  if (elements.sideMenu.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-event-button').style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
  } else if (elements.nameList.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-member-button').style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
  } else if (elements.venueList.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-venue-button').style.display = 'block';
      document.addEventListener('click', handleClickForContextMenu);
  } 
});

function getPath(u) {
  try {
    const url_obj = new URL(u);
    return url_obj.pathname;
  } catch (e) {
    console.error("Invalid URL:", u, e);
    return "";
  }
}
window.getPath = getPath;

document.addEventListener('htmx:afterSwap', (event) => {
  const url = event.detail.xhr.responseURL;
  const path = getPath(url);

  if (path === '/' || path === '/view/month') {
    setMonthScrollPosition();
  } else if (path === '/api/scrolling-up') {
    const calendarBody = document.getElementById('calendar-body');
    const calendarContent = document.getElementById('calendar-content');
    const week = calendarContent.querySelectorAll('.week-row')[0];
    const originalScrollBehavior = calendarBody.style.scrollBehavior;
    calendarBody.style.scrollBehavior = 'auto';
    calendarBody.scrollTop = state.previousScroll + 6*week.offsetHeight;
    calendarBody.style.scrollBehavior = originalScrollBehavior;
  } else if (path === '/api/scrolling-down') {
    const calendarBody = document.getElementById('calendar-body');
    const calendarContent = document.getElementById('calendar-content');
    const week = calendarContent.querySelectorAll('.week-row')[0];
    const originalScrollBehavior = calendarBody.style.scrollBehavior;
    calendarBody.style.scrollBehavior = 'auto';
    calendarBody.scrollTop = state.previousScroll - 6*week.offsetHeight;
    calendarBody.style.scrollBehavior = originalScrollBehavior;
  }
});

document.addEventListener('htmx:beforeSwap', (event) => {
  const url = event.detail.xhr.responseURL;
  const path = getPath(url);

  if (path === '/api/scrolling-up' || path === '/api/scrolling-down') {
    state.previousScroll = document.getElementById("calendar-body").scrollTop;
  }
});

function handleClickOnSideMenuButton(button) {
  let sideMenuContainer = elements.sideMenuContainer;

  if (state.sideMenuIsOpen) {
    sideMenuContainer.removeChild(elements.sideMenu);
  } else {
    sideMenuContainer.appendChild(elements.sideMenu);
  }

  state.sideMenuIsOpen ^= true;
}
window.handleClickOnSideMenuButton = handleClickOnSideMenuButton;

function postString(url, str) {
  writer = new BufferWriter();
  writer.writeString(str);
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: writer.getBuffer(),
  })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }})
    .catch(e => {
      console.error(`Error: ${e}`);
    });
}

function handleCreateNewStaffMember() {
  const staffList = elements.nameList;
  const button = document.createElement('button');
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'agentname';
  input.name = 'eventname';
  input.placeholder = 'Nouvel Agent';
  button.appendChild(input);
  staffList.appendChild(button);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      input.remove();
      button.textContent = value;
      data.staffNames.push(value);
      button.onclick = function() {
        handle2StateButtonClick(this);
      };
      button.className = 'hover';
      postString('/store/agent', value);
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });
}
window.handleCreateNewStaffMember = handleCreateNewStaffMember;

function handleCreateNewVenue() {
  const venueList = elements.venueList;
  const button = document.createElement('button');
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'venuename';
  input.name = 'venuename';
  input.placeholder = 'Nouveau Lieu';
  button.appendChild(input);
  venueList.appendChild(button);
  input.focus();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value;
      input.remove();
      button.textContent = value;
      data.venueNames.push(value);
      button.onclick = function() {
        handle2StateButtonClick(this);
      };
      button.className = 'hover';
      postString('/store/venue', value);
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });
}
window.handleCreateNewVenue = handleCreateNewVenue;

function handleClickForOptionMenu(event) {
  let menu = elements.createOptionMenu;
  if (!menu.contains(event.target) && !elements.rightClickMenu.contains(event.target)) {
    menu.style.display = 'none';
    document.removeEventListener('click', handleClickForOptionMenu);
    let input = menu.querySelectorAll('input')[0];
    input.removeEventListener('input', state.handleTyping);

    const staffIds = [];
    const nameList = elements.nameList;
    for (const name of nameList.children) {
      if (name.classList.contains('clicked')) {
        staffIds.push(parseInt(name.dataset.idx));
      }
    }

    const venueIds = [];
    const venueList = element.venueList;
    for (const venue of venueList.children) {
      if (venue.classList.contains('clicked')) {
        venueIds.push(parseInt(venue.dataset.idx));
      }
    }

    const writer = new BufferWriter();
    writer.writeString(input.value);
    writer.writeInt32Array(staffIds);
    writer.writeInt32Array(venueIds);

    fetch("store/event", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: writer.getBuffer(),
    })
    .then(resp => {
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }})
    .catch(e => {
      console.error(`Error: ${e}`);
    });

    input.value = "";
  }
};

function handleClickForContextMenu() {
  let menu = elements.rightClickMenu;
  menu.style.display = 'none';
  document.removeEventListener('click', handleClickForContextMenu);
  for (const child of menu.children) {
    child.style.display = 'none';
  }
}

function handleClickOnEventButton(e) {
  e.style.backgroundColor = palette.red;
  if (state.selected_element) {
    state.selected_element.style.backgroundColor = 'transparent';
  }
  state.selected_element = e;
}
window.handleClickOnEventButton = handleClickOnEventButton;

function handleCreateNewEvent() {
  let menu = elements.sideMenu;
  let new_button = document.createElement('button');
  new_button.classList.add('event-button');
  new_button.textContent = "Nouvel Événement";
  new_button.setAttribute('onclick', 'handleClickOnEventButton(this)');
  menu.appendChild(new_button);
  
  const rect = new_button.getBoundingClientRect();
  menu = document.getElementById('create-option-menu');
  menu.style.display = 'flex';
  menu.style.left = rect.right + 'px';
  menu.style.top = rect.top + 'px';

  let input = menu.querySelectorAll('input')[0];
  input.focus();
  
  state.handleTyping = function(event) {
    if (event.target.value === "") {
      new_button.textContent = "Nouvel Événement";
    } else {
      new_button.textContent = event.target.value;
    }
  };

  input.addEventListener('input', state.handleTyping);
}
window.handleCreateNewEvent = handleCreateNewEvent;

function handle2StateButtonClick(b) {
  b.classList.toggle('clicked');
}
window.handle2StateButtonClick = handle2StateButtonClick;
