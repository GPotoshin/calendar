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

let data = {
  EventNames: [],
  EventStaff: [],
  EventVenues: [],
  EventFreeList: [],

  StaffNames: [],
  StaffFreeList: [],
  
  VenueNames: [],
  VenueFreeList: [],
}

function readData(reader) {
  const data = {};

  data.EventNames = reader.readStringArray();
  data.EventStaff = reader.readArrayOfInt32Arrays();
  data.EventVenues = reader.readArrayOfInt32Arrays();
  data.StaffNames = reader.readStringArray();
  data.VenueNames = reader.readStringArray();

  return data;
}

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
    data = readData(r)
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

document.addEventListener('contextmenu', function(e) {
  const menu = elements.rightClickMenu;
  if (elements.sideMenu.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-event-button').style.display = "block";
      document.addEventListener('click', handleClickForContextMenu);
  } else if (elements.nameList.contains(e.target)) {
      e.preventDefault();
      menu.style.display = 'flex';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.getElementById('new-member-button').style.display = "block";
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
      button.onclick = function() {
        handle2StateButtonClick(this);
      };
      button.className = 'hover';
    } else if (e.key === 'Escape') {
      input.remove();
    }
  });
}
window.handleCreateNewStaffMember = handleCreateNewStaffMember;

async function handleClickForOptionMenu(event) {
  let menu = elements.createOptionMenu;
  if (!menu.contains(event.target) && !element.rightClickMenu(event.target)) {
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
    
    try {
      const resp = await fetch("store/event", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: writer.getBuffer(),
      });

      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
    } catch(e) {
      console.error(`Error: ${e}`);
    }

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
