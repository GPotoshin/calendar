package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
  "html/template"
	"io"
	"log/slog"
	"net/http"
	"time"
  "bytes"
  "os"
  "sort"
)

func (s *State) initAuth() {
  s.ConnectionsToken = make(map[[32]byte]int)
}

func (s *State) getPublicKey() []byte {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
  retval := make([]byte, len(s.publicKey))
  copy(retval, s.publicKey)
	return retval
}

func (s *State) decrypt(data []byte) ([]byte, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return rsa.DecryptOAEP(sha256.New(), rand.Reader, s.privateKey, data, nil)
}

func (s *State) validateToken(token [32]byte) (int32, bool) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	idx, exists := s.ConnectionsToken[token]
	if !exists || idx < 0 {
		return -1, false
	}

	if time.Now().After(s.ConnectionsTime[idx][1]) {
		return -1, false
	}

	return s.ConnectionsUser[idx], true
}

func (s *State) cleanupExpiredTokens() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	now := time.Now()
	for token, idx := range s.ConnectionsToken {
		if now.After(s.ConnectionsTime[idx][1]) {
      deleteToken(s.ConnectionsToken, &s.ConnectionsFreeList, token)
		}
	}
  sort.Ints(s.ConnectionsFreeList)
  rebaseMap(s.ConnectionsToken, s.ConnectionsFreeList)
  shrinkArray(&s.ConnectionsUser, s.ConnectionsFreeList)
  shrinkArray(&s.ConnectionsTime, s.ConnectionsFreeList)
  shrinkArray(&s.ConnectionsChannel, s.ConnectionsFreeList)
  s.ConnectionsFreeList = s.ConnectionsFreeList[:0]
}

func (s *State) startKeyRotation() {
  if err := s.generateKeys(); err != nil {
    slog.Error("failed to iniate auth keys", "cause", err)
    os.Exit(1)
  }
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			slog.Info("rotating rsa keys...")
			if err := s.generateKeys(); err != nil {
				slog.Error("failed to rotate keys: %v\n", err)
			} else { // we need to send new key to open connections
				slog.Info("keys rotated successfully")
			}
		}
	}()
}

func (s *State) generateKeys() error {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
    slog.Error("Can't regenerate a private key")
		return err
	}
  publicKey, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
    slog.Error("Can't regenerate a public key")
		return err
	}
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.privateKey = privateKey
	s.keyGeneratedAt = time.Now()
  s.publicKey = publicKey
	return nil
}

func (s *State) startTokenCleanup() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for range ticker.C {
			s.cleanupExpiredTokens()
		}
	}()
}

func handlePublicKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	pubKey := state.getPublicKey()
	if err := writeBytes(w, pubKey); err != nil {
		slog.Error("Failed to write public key", "cause", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	encryptedSize, err := readInt32(r.Body)
	if err != nil {
		slog.Error("Failed to read encrypted data size", "cause", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	if encryptedSize < 0 || encryptedSize > 1024*1024 {
		slog.Error("Invalid encrypted data size", "size", encryptedSize)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	encryptedData := make([]byte, encryptedSize)
	if _, err := io.ReadFull(r.Body, encryptedData); err != nil {
		slog.Error("Failed to read encrypted data: %v\n", "cause", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	decryptedData, err := state.decrypt(encryptedData)
	if err != nil {
		slog.Error("Failed to decrypt data", "cause", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

  reader := bytes.NewReader(decryptedData)

	userId, err := readInt32(reader)
	if err != nil {
		slog.Error("Failed to parse username", "cause", err)
		return
	}

	password, err := readHash(reader)
	if err != nil {
		slog.Error("Failed to parse password", "cause", err)
		return
	}

  state.mutex.Lock()
  idx, exists := state.UsersId[userId]
  if (!exists) { 
    state.mutex.Unlock()
    http.Error(w, "Incorrect Login or Password", http.StatusBadRequest)
    return
  }
  if (state.UsersPassword[idx] != password) {
    state.mutex.Unlock()
    http.Error(w, "Incorrect Login or Password", http.StatusBadRequest)
    return
  }
  state.mutex.Unlock()

  var token [32]byte
  for i := 0; i < 10; i++ {
    if _, err := rand.Read(token[:]); err != nil {
      slog.Error("entropy source error", "cause", err)
      http.Error(w, "Entropy source error", http.StatusInternalServerError)
      return
    }

    now := time.Now()

    state.mutex.Lock()
    _, exists := state.ConnectionsToken[token]
    if !exists {
      idx := storageIndex(state.ConnectionsToken, &state.ConnectionsFreeList)
      state.ConnectionsToken[token] = idx
      storeValue(&state.ConnectionsUser, idx, userId)
      storeValue(&state.ConnectionsTime, idx, [2]time.Time{now, now.Add(time.Hour)})
      storeValue(&state.ConnectionsChannel, idx, make(chan []byte))

      state.mutex.Unlock()
      goto _token_generation_success
    }
    state.mutex.Unlock()
  }

  slog.Error("Failed to generate token", "cause", err)
  http.Error(w, "Failed to generate token", http.StatusInternalServerError)
  return

  _token_generation_success:
  if err := writeHash(w, token); err != nil {
    slog.Error("Failed to write token", "cause", err)
    return
  }

  state.mutex.Lock()
  privilege := state.UsersPrivilegeLevel[idx]
  state.mutex.Unlock()

  if err := writeInt32(w, privilege); err != nil {
    slog.Error("Failed to write prvilegeLevel", "cause", err)
    return
  }

  t, err := template.ParseFiles("index.html", "month.html")
  if err != nil {
    slog.Error("failed to parse index.html and month.html", "cause", err);
  }

  type DayData struct {}
  type WeekData struct { Days [7]DayData }
  type BlockData struct { Weeks []WeekData }
  type MonthData struct { Blocks [3]BlockData }
  var block_sizes = []int{2, 16, 2}
  var data MonthData
  data.Blocks[0] = BlockData{Weeks: make([]WeekData, block_sizes[0])}
  data.Blocks[1] = BlockData{Weeks: make([]WeekData, block_sizes[1])}
  data.Blocks[2] = BlockData{Weeks: make([]WeekData, block_sizes[2])}
  var buf bytes.Buffer
  err = t.Execute(&buf, data)

  if err != nil {
    slog.Error("failed to compose App", "cause", err);
  }
  if err := writeBytes(w, buf.Bytes()); err != nil {
    slog.Error("Failed to write App", "cause", err)
    return
  }
  slog.Info("User logged in successfully", "id", userId)
  return
}
