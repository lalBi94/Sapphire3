package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"sync"
	"time"
)

// Application Discord commune à tous les utilisateurs de Sapphire 3.
const applicationID = "1568755585250492416"
const maxBackoff = 60 * time.Second
const handshakeTimeout = 3 * time.Second
const pingInterval = 15 * time.Second

// Un flux IPC minimal : les pipes Windows et les sockets Unix le satisfont tous les deux.
type stream interface {
	io.Reader
	io.Writer
	io.Closer
}

type connection struct {
	conn stream
}

type presence struct {
	mu        sync.Mutex
	appPID    int
	conn      *connection
	connected bool
	ready     bool
	latest    string
	cleared   bool
	lastSent  string
	backoff   time.Duration
	nextRetry time.Time
	nextPing  time.Time
	nonce     int
}

// Point d'entrée : lit les commandes du frontend et maintient une présence Discord.
func main() {
	appPID := 0
	if len(os.Args) > 1 {
		appPID, _ = strconv.Atoi(os.Args[1])
	}
	p := &presence{appPID: appPID, backoff: time.Second}
	lines := make(chan string, 32)
	go func() {
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			lines <- scanner.Text()
		}
		close(lines)
	}()

	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case line, ok := <-lines:
			if !ok {
				p.shutdown()
				return
			}
			if p.handle(line) {
				p.shutdown()
				return
			}
		case <-ticker.C:
			p.tick()
		}
	}
}

// Interprète A (activité JSON), C (effacement) et Q (arrêt).
func (p *presence) handle(line string) bool {
	if line == "" {
		return false
	}
	switch line[0] {
	case 'A':
		p.mu.Lock()
		p.latest = line[1:]
		p.cleared = false
		p.mu.Unlock()
		p.flush()
	case 'C':
		p.mu.Lock()
		p.latest = ""
		p.cleared = true
		p.mu.Unlock()
		p.flush()
	case 'Q':
		p.clear()
		return true
	}
	return false
}

// Tente une connexion, surveille la connexion et envoie les mises à jour utiles.
func (p *presence) tick() {
	p.mu.Lock()
	if !p.connected || !p.ready || p.conn == nil {
		if p.conn != nil {
			_ = p.conn.conn.Close()
		}
		p.conn = nil
		p.connected = false
		p.ready = false
		if time.Now().After(p.nextRetry) {
			p.mu.Unlock()
			p.connect()
			return
		}
		p.mu.Unlock()
		return
	}
	conn := p.conn
	needFlush := p.lastSent != p.latest || p.cleared
	ping := time.Now().After(p.nextPing)
	p.mu.Unlock()
	if needFlush {
		p.flush()
		return
	}
	if ping {
		if err := writeFrame(conn.conn, 3, nil); err != nil {
			p.disconnect()
			return
		}
		p.mu.Lock()
		p.nextPing = time.Now().Add(pingInterval)
		p.mu.Unlock()
	}
}

// Ouvre le premier IPC Discord disponible et attend READY sans lecture concurrente.
func (p *presence) connect() {
	conn, err := connectDiscord()
	if err != nil {
		p.scheduleRetry()
		return
	}
	if err := writeFrame(conn, 0, []byte(fmt.Sprintf(`{"v":1,"client_id":"%s"}`, applicationID))); err != nil {
		_ = conn.Close()
		p.scheduleRetry()
		return
	}
	if !waitReady(conn, handshakeTimeout) {
		_ = conn.Close()
		p.scheduleRetry()
		return
	}
	p.mu.Lock()
	p.conn = &connection{conn: conn}
	p.connected = true
	p.ready = true
	p.backoff = time.Second
	p.nextPing = time.Now().Add(pingInterval)
	p.lastSent = ""
	p.mu.Unlock()
	p.flush()
}

// Attend READY dans une goroutine dédiée ; après READY, aucune lecture concurrente ne reste.
func waitReady(conn stream, timeout time.Duration) bool {
	result := make(chan bool, 1)
	go func() {
		for {
			opcode, payload, err := readFrame(conn)
			if err != nil {
				result <- false
				return
			}
			if opcode == 1 && isReady(payload) {
				result <- true
				return
			}
		}
	}()
	select {
	case ready := <-result:
		return ready
	case <-time.After(timeout):
		return false
	}
}

// Envoie l'activité courante si elle diffère de la dernière envoyée.
func (p *presence) flush() {
	p.mu.Lock()
	c := p.conn
	connected := p.connected && p.ready && c != nil
	latest := p.latest
	cleared := p.cleared
	lastSent := p.lastSent
	p.mu.Unlock()
	if !connected {
		return
	}
	if !cleared && latest == lastSent {
		return
	}
	activity := latest
	if cleared || activity == "" {
		activity = "null"
	}
	p.mu.Lock()
	p.nonce++
	nonce := p.nonce
	p.mu.Unlock()
	if err := writeFrame(c.conn, 1, activityFrame(p.appPID, activity, nonce)); err != nil {
		p.disconnect()
		return
	}
	p.mu.Lock()
	p.lastSent = latest
	p.mu.Unlock()
}

// Efface la présence avant de quitter.
func (p *presence) clear() {
	p.mu.Lock()
	p.latest = ""
	p.cleared = true
	p.mu.Unlock()
	p.flush()
}

// Ferme proprement la connexion et efface l'activité.
func (p *presence) shutdown() {
	p.clear()
	p.mu.Lock()
	if p.conn != nil {
		_ = p.conn.conn.Close()
	}
	p.mu.Unlock()
}

// Coupe une connexion morte et planifie une reconnexion.
func (p *presence) disconnect() {
	p.mu.Lock()
	if p.conn != nil {
		_ = p.conn.conn.Close()
	}
	p.conn = nil
	p.connected = false
	p.ready = false
	p.mu.Unlock()
	p.scheduleRetry()
}

// Backoff exponentiel borné, jamais de boucle serrée.
func (p *presence) scheduleRetry() {
	p.mu.Lock()
	p.nextRetry = time.Now().Add(p.backoff)
	p.backoff = nextBackoff(p.backoff)
	p.mu.Unlock()
}

// Double le délai sans dépasser la borne.
func nextBackoff(current time.Duration) time.Duration {
	next := current * 2
	if next > maxBackoff {
		return maxBackoff
	}
	return next
}

// Construit la commande SET_ACTIVITY sans parser le JSON de l'activité.
func activityFrame(pid int, activity string, nonce int) []byte {
	return []byte(fmt.Sprintf(`{"cmd":"SET_ACTIVITY","nonce":"sapphire-%d","args":{"pid":%d,"activity":%s}}`, nonce, pid, activity))
}

// Reconnaît READY malgré les variantes d'espacement de Discord.
func isReady(payload []byte) bool {
	return bytes.Contains(payload, []byte(`"evt":"READY"`)) || bytes.Contains(payload, []byte(`"evt": "READY"`))
}

// Écrit une trame Discord complète en une seule opération, compatible avec les pipes message.
func writeFrame(w io.Writer, opcode uint32, payload []byte) error {
	frame := make([]byte, 8+len(payload))
	binary.LittleEndian.PutUint32(frame[0:4], opcode)
	binary.LittleEndian.PutUint32(frame[4:8], uint32(len(payload)))
	copy(frame[8:], payload)
	_, err := w.Write(frame)
	return err
}

// Lit une trame Discord avec une borne de taille défensive.
func readFrame(r io.Reader) (uint32, []byte, error) {
	header := make([]byte, 8)
	if _, err := io.ReadFull(r, header); err != nil {
		return 0, nil, err
	}
	opcode := binary.LittleEndian.Uint32(header[0:4])
	length := binary.LittleEndian.Uint32(header[4:8])
	if length > 4*1024*1024 {
		return 0, nil, errors.New("discord frame too large")
	}
	payload := make([]byte, length)
	if _, err := io.ReadFull(r, payload); err != nil {
		return 0, nil, err
	}
	return opcode, payload, nil
}
