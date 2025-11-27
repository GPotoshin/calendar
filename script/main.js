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
  side_menu: null,
}

elements.side_menu = document.createElement('div');
elements.side_menu.classList.add("v-container");
elements.side_menu.id = 'side-menu';

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

function handleClickOnSideMenuButton(button) {
  let side_menu_container = document.getElementById('side-menu-container');

  if (state.sideMenuIsOpen) {
    side_menu_container.removeChild(elements.side_menu);
  } else {
    side_menu_container.appendChild(elements.side_menu);
  }

  state.sideMenuIsOpen ^= true;
}
window.handleClickOnSideMenuButton = handleClickOnSideMenuButton;

async function handleClickForOptionMenu(event) {
  let menu = document.getElementById('create-option-menu');
  if (!menu.contains(event.target)) {
    menu.style.display = 'none';
    document.removeEventListener('click', handleClickForOptionMenu);
    let input = menu.querySelectorAll('input')[0];
    input.removeEventListener('input', state.handleTyping);

    const staffIds = [];
    const nameList = document.getElementById('name-list');
    for (const name of nameList.children) {
      if (name.classList.contains('clicked')) {
        staffIds.push(parseInt(name.dataset.idx));
      }
    }

    const enueIds = [];
    const venueList = document.getElementById('venue-list');
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
  let menu = document.getElementById('right-click-menu');
  menu.style.display = 'none';
  document.removeEventListener('click', handleClickForContextMenu);
}

document.addEventListener('click', (event) => {
  if (event.target.id == 'new-event-button') {
  // we fucking can't do that in click function because after this button
  // handling function we get immidiately a click event and that is fucking
  // retarded because this handleClickForOptionMenu function closes the menu
  // and we don't get the menu
    document.addEventListener('click', handleClickForOptionMenu);
  }
});

document.addEventListener('DOMContentLoaded', async (event) => {
  setMonthScrollPosition();
  const calendarBody = document.getElementById('calendar-body');
  calendarBody.addEventListener('mousedown', handleMouseDown);
  calendarBody.addEventListener('mouseup', handleMouseUp);
  calendarBody.addEventListener('mousemove', handleMouseMove);

  try {
    const response = await fetch("/data");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const bin = await response.arrayBuffer();
    const r = new BufferReader(bin);
    data = readData(r)
  } catch (error) {
    console.error('Could not fetch data:', error);
  }

  const sideMenu = document.getElementById('side-menu-container');
  sideMenu.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    let menu = document.getElementById('right-click-menu');
    menu.style.display = 'flex';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    document.addEventListener('click', handleClickForContextMenu);
  });
});

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

function handleClickOnEventButton(e) {
  e.style.backgroundColor = palette.red;
  if (state.selected_element) {
    state.selected_element.style.backgroundColor = 'transparent';
  }
  state.selected_element = e;
}
window.handleClickOnEventButton = handleClickOnEventButton;


function handleCreateNewEvent() {
  let menu = document.getElementById("side-menu");
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
