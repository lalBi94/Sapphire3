package main

import (
	"bytes"
	"encoding/json"
	"net"
	"testing"
	"time"
)

// Vérifie l'encodage et la lecture d'une trame complète.
func TestFrameRoundTrip(t *testing.T) {
	client, server := net.Pipe()
	defer client.Close()
	defer server.Close()
	payload := []byte(`{"cmd":"PING"}`)
	go func() { _ = writeFrame(client, 1, payload) }()
	opcode, received, err := readFrame(server)
	if err != nil {
		t.Fatalf("readFrame: %v", err)
	}
	if opcode != 1 {
		t.Fatalf("opcode = %d", opcode)
	}
	if !bytes.Equal(received, payload) {
		t.Fatalf("payload = %s", received)
	}
}

// Vérifie que la commande SET_ACTIVITY conserve l'activité et le pid.
func TestActivityFrame(t *testing.T) {
	frame := activityFrame(4242, `{"details":"Test"}`, 7)
	var value map[string]any
	if err := json.Unmarshal(frame, &value); err != nil {
		t.Fatalf("json: %v", err)
	}
	if value["cmd"] != "SET_ACTIVITY" {
		t.Fatalf("cmd = %v", value["cmd"])
	}
	args := value["args"].(map[string]any)
	if args["pid"].(float64) != 4242 {
		t.Fatalf("pid = %v", args["pid"])
	}
	activity := args["activity"].(map[string]any)
	if activity["details"] != "Test" {
		t.Fatalf("details = %v", activity["details"])
	}
}

// Vérifie la reconnaissance de READY avec les deux espacements connus.
func TestReadyDetection(t *testing.T) {
	for _, payload := range []string{
		`{"cmd":"DISPATCH","evt":"READY","data":{}}`,
		`{"cmd": "DISPATCH", "evt": "READY", "data": {}}`,
	} {
		if !isReady([]byte(payload)) {
			t.Fatalf("READY non reconnu : %s", payload)
		}
	}
	if isReady([]byte(`{"evt":"ERROR"}`)) {
		t.Fatal("ERROR confondu avec READY")
	}
}

// Vérifie le backoff exponentiel et sa borne.
func TestNextBackoff(t *testing.T) {
	cases := []struct {
		current time.Duration
		want    time.Duration
	}{
		{time.Second, 2 * time.Second},
		{16 * time.Second, 32 * time.Second},
		{32 * time.Second, maxBackoff},
		{maxBackoff, maxBackoff},
	}
	for _, test := range cases {
		if got := nextBackoff(test.current); got != test.want {
			t.Fatalf("nextBackoff(%v) = %v, want %v", test.current, got, test.want)
		}
	}
}
