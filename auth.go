package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
  "html/template"
	"io"
	"log"
  "fmt"
	"net/http"
	"time"
  "bytes"
  "os"
)

func (s *ApplicationState) initAuth() {
  s.ConnectionsToken = make(map[[32]byte]int)
}

func (s *ApplicationState) generateKeys() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	s.privateKey = privateKey
	s.keyGeneratedAt = time.Now()
  s.publicKey, err = x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	return err
}

func (s *ApplicationState) getPublicKey() []byte {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
  retval := make([]byte, len(s.publicKey))
  copy(retval, s.publicKey)
	return retval
}

func (s *ApplicationState) decrypt(data []byte) ([]byte, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return rsa.DecryptOAEP(sha256.New(), rand.Reader, s.privateKey, data, nil)
}

func (s *ApplicationState) validateToken(token [32]byte) (int32, bool) {
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

func (s *ApplicationState) cleanupExpiredTokens() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	now := time.Now()
	for token, idx := range s.ConnectionsToken {
		if now.After(s.ConnectionsTime[idx][1]) {
      state.mutex.Lock()
      deleteToken(s.ConnectionsToken, &s.ConnectionsFreeList, token)
      shrinkArray(&s.ConnectionsUser, s.ConnectionsFreeList)
      shrinkArray(&s.ConnectionsTime, s.ConnectionsFreeList)
      shrinkArray(&s.ConnectionsChannel, s.ConnectionsFreeList)
      s.ConnectionsFreeList = s.ConnectionsFreeList[:0]
      state.mutex.Unlock()
		}
	}
}

func (s *ApplicationState) startKeyRotation() {
  if err := s.generateKeys(); err != nil {
    log.Printf("Failed to iniate auth keys: %v\n", err)
    os.Exit(1)
  }
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			log.Println("Rotating RSA keys...")
			if err := s.generateKeys(); err != nil {
				log.Printf("Failed to rotate keys: %v\n", err)
			} else { // we need to send new key to open connections
				log.Println("Keys rotated successfully")
			}
		}
	}()
}

func (s *ApplicationState) startTokenCleanup() {
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
		log.Printf("Failed to write public key: %v\n", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
  fmt.Println("Handeling login")
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

  log.Println("reading payload size")
	encryptedSize, err := readInt32(r.Body)
	if err != nil {
		log.Printf("Failed to read encrypted data size: %v\n", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

  log.Println("checking payload size")
	if encryptedSize < 0 || encryptedSize > 1024*1024 {
		log.Printf("Invalid encrypted data size: %d\n", encryptedSize)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

  log.Println("reading encrypted data")
	encryptedData := make([]byte, encryptedSize)
	if _, err := io.ReadFull(r.Body, encryptedData); err != nil {
		log.Printf("Failed to read encrypted data: %v\n", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

  log.Println("Decrypting the data")
	decryptedData, err := state.decrypt(encryptedData)
	if err != nil {
		log.Printf("Failed to decrypt data: %v\n", err)
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

  reader := bytes.NewReader(decryptedData)

	userId, err := readInt32(reader)
	if err != nil {
		log.Printf("Failed to parse username: %v\n", err)
		return
	}

	password, err := readHash(reader)
	if err != nil {
		log.Printf("Failed to parse password: %v\n", err)
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
      log.Printf("entropy source error: %w", err)
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

  log.Printf("Failed to generate token: %v\n", err)
  http.Error(w, "Failed to generate token", http.StatusInternalServerError)
  return

  _token_generation_success:
  if err := writeHash(w, token); err != nil {
    log.Printf("Failed to write token: %v\n", err)
    return
  }

  state.mutex.Lock()
  privilege := state.UsersPrivilegeLevel[idx]
  state.mutex.Unlock()

  if err := writeInt32(w, privilege); err != nil {
    log.Printf("Failed to write prvilegeLevel: %v\n", err)
    return
  }

  t, err := template.ParseFiles("index.html", "month.html")
  if err != nil {
    log.Printf("failed to parse index.html and month.html: %v\n", err);
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
    log.Printf("failed to compose App: %v\n", err);
  }
  if err := writeBytes(w, buf.Bytes()); err != nil {
    log.Printf("Failed to write App: %v\n", err)
    return
  }
  log.Printf("User %s logged in successfully\n", userId)
  return
}
