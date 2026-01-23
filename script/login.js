import { BufferReader, BufferWriter } from './io.js';
import * as Utils from './utils.js';
const idInput = document.getElementById('id');
const passwordInput = document.getElementById('password');
const connectButton = document.getElementById('connect');

idInput.addEventListener('input', () => {
  idInput.value = Utils.digitise(idInput.value);
});

let publicKey = null;
export let token = null;

async function encryptCredentials(buf) {
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    publicKey,
    buf
  );

  var bw = new BufferWriter();
  bw.writeUint8Array(new Uint8Array(encryptedBuffer));

  return bw.getBuffer();
}

(async function initializeAuth() {
  try {
    const response = await fetch('/api/public-key');
    if (!response.ok) throw new Error('Network response was not ok');
    const buffer = await response.arrayBuffer();
    const reader = new BufferReader(buffer);

    const publicKeyBytes = reader.readBytes();
    publicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBytes,
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

connectButton.addEventListener('click', async () => {
  const username = idInput.value.trim();
  const password = passwordInput.value;

  // Validate input
  if (!username || !password) {
    alert('Please enter both username and password'); // @nocheckin
    return;
  }

  if (!publicKey) {
    alert('Authentication not ready. Please wait or refresh the page.'); // @nocheckin
    return;
  }

  connectButton.disabled = true;
  const originalText = connectButton.textContent;
  connectButton.textContent = 'Connecting...';

  try {
    if (!publicKey) {
      throw new Error('Public key not loaded');
    }

    let bw = new BufferWriter();
    bw.writeInt32(Number(username))

    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordData);
    const hashBytes = new Uint8Array(hashBuffer);

    bw.writeHash(hashBytes);

    const timestamp = Math.floor(Date.now() / 1000);
    bw.writeInt32(timestamp);

    const encryptedData = await encryptCredentials(bw.getBuffer());
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: encryptedData,
    });

    Utils.throwIfNotOk(resp);
    const bin = await resp.arrayBuffer();
    const r = new BufferReader(bin);

    token = r.readHash();
    // all transactions are tokenised. Fucking browser with a full security
    // policy leaves me no choice. But we run the check from the loaded script
    // and anyway all transations are tokenised
    let privilege = r.readInt32();  
    let entrypoint = '';
    if (privilege == -2) {
      entrypoint = './entry_point_admin.js';
    } else if (privilege == -1) {
      entrypoint = './entry_point_user.js';
    } else if (privilege >= 0) {
      entrypoint = './entry_point_chef.js';
    }

    let html = r.readString();
    passwordInput.value = '';
    document.body.innerHTML = html;
    document.body.className = "";

    import(entrypoint)
    .catch((err) => {
      console.error("Failed to load entrypoint:", err);
    });
  } catch (error) {
    alert('Login failed: ' + error.message);
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = originalText;
  }
});

passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectButton.click();
  }
});
