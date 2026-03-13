import * as Io from './io.js';
import * as Utilities from './utilities.js';

export let public_key = null;

const matricule_input = document.getElementById('id');
const password_input = document.getElementById('password');
const connect_button = document.getElementById('connect');

matricule_input.addEventListener('input', () => {
  matricule_input.value = Utilities.digitise(matricule_input.value);
});

export let token = null;
export let privilege = undefined;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
}

(async function initializeAuth() {
  try {
    const response = await fetch('/api/public-key');
    if (!response.ok) throw new Error('Network response was not ok');
    const buffer = await response.arrayBuffer();
    const reader = new Io.BufferReader(buffer);

    const public_key_bytes = Io.readBytes(reader);
    public_key = await crypto.subtle.importKey(
      "spki",
      public_key_bytes,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      true,
      ["encrypt"]
    );
  } catch (error) {
    console.error('Failed to fetch public key:', error);
    alert('Failed to initialize authentication. Please refresh the page.');
  }
})();

connect_button.addEventListener('click', async () => {
  const username = matricule_input.value.trim();
  const password = password_input.value;

  // Validate input
  if (!username || !password) {
    alert('Please enter both username and password'); // @nocheckin: we should have a custom menu
    return;
  }

  if (!public_key) {
    alert('Authentication not ready. Please wait or refresh the page.'); // @nocheckin
    return;
  }

  connect_button.disabled = true;
  const originalText = connect_button.textContent;
  connect_button.textContent = 'Connecting...';

  try {
    const buffer_writer = new Io.BufferWriter();
    Io.writeString(buffer_writer, "magic");
    Io.writeInt32(buffer_writer, Number(username));
    const hashBytes = await Io.hashText(password);
    Io.writeHash(buffer_writer, hashBytes);
    const timestamp = Math.floor(Date.now() / 1000);
    Io.writeInt32(buffer_writer, timestamp);

    const w = await Io.encryptAndPackage(buffer_writer.getBuffer(), public_key);

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: w.getBuffer(),
    });

    Utilities.throwIfNotOk(response);
    const binary = await response.arrayBuffer();
    const reader = new Io.BufferReader(binary);

    token = Io.readHash(reader);

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SET_TOKEN',
        token: token,
      });
    }
    privilege = Io.readInt32(reader);  

    let entrypoint = '';
    if (privilege == -2) {
      entrypoint = './admin_entry_point.js';
    } else if (privilege == -1) {
      entrypoint = './user_entry_point.js';
    } else if (privilege >= 0) {
      entrypoint = './chef_entry_point.js';
    }

    let html = Io.readStringWithLimit(reader, 1<<16);
    password_input.value = '';
    document.body.innerHTML = html;
    document.body.className = "";
    Utilities.appendMeasure();

    setTimeout(() => {
      import(entrypoint)
        .catch(error => {
          console.error("Failed to load entrypoint:", error);
        });
    });
  } catch (error) {
    alert('Login failed: ' + error.message);
  } finally {
    connect_button.disabled = false;
    connect_button.textContent = originalText;
  }
});

password_input.addEventListener('keypress', event => {
  if (event.key === 'Enter') {
    connect_button.click();
  }
});
