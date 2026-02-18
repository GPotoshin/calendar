import * as Io from './io.js';
import * as Utilities from './utilities.js';
const matricule_input = document.getElementById('id');
const password_input = document.getElementById('password');
const connect_button = document.getElementById('connect');

matricule_input.addEventListener('input', () => {
  matricule_input.value = Utilities.digitise(matricule_input.value);
});

let public_key = null;
export let token = null;

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
    Io.writeInt32(buffer_writer, Number(username))

    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordData);
    const hashBytes = new Uint8Array(hashBuffer);

    Io.writeHash(buffer_writer, hashBytes);

    const timestamp = Math.floor(Date.now() / 1000);
    Io.writeInt32(buffer_writer, timestamp);

    const encrypted_buffer = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      public_key,
      buffer_writer.getBuffer(),
    );

    // we need it to write a prefixed size. but maybe we don't need
    // prefixed size
    const encrypted_buffer_writer = new Io.BufferWriter();
    Io.writeUint8Array(
      encrypted_buffer_writer,
      new Uint8Array(encrypted_buffer),
    );

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: encrypted_buffer_writer.getBuffer(),
    });

    Utilities.throwIfNotOk(response);
    const binary = await response.arrayBuffer();
    const reader = new Io.BufferReader(binary);

    token = Io.readHash(reader);
    const privilege = Io.readInt32(reader);  

    let entrypoint = '';
    if (privilege == -2) {
      entrypoint = './entry_point_admin.js';
    } else if (privilege == -1) {
      entrypoint = './entry_point_user.js';
    } else if (privilege >= 0) {
      entrypoint = './entry_point_chef.js';
    }

    let html = Io.readStringWithLimit(reader, 1<<16);
    password_input.value = '';
    document.body.innerHTML = html;
    document.body.className = "";
    Utilities.appendMeasure();

    import(entrypoint)
    .catch(error => {
      console.error("Failed to load entrypoint:", error);
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
