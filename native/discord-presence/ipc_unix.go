//go:build !windows

package main

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"time"
)

// Reproduit l'ordre de résolution des sockets Discord sous Linux et macOS.
func connectDiscord() (stream, error) {
	if override := os.Getenv("SAPPHIRE_DISCORD_IPC_PATH"); override != "" {
		return net.DialTimeout("unix", override, 500*time.Millisecond)
	}
	bases := []string{
		os.Getenv("XDG_RUNTIME_DIR"),
		os.Getenv("TMPDIR"),
		os.Getenv("TMP"),
		os.Getenv("TEMP"),
		"/tmp",
	}
	seen := map[string]bool{}
	var last error
	for index := 0; index < 10; index++ {
		name := fmt.Sprintf("discord-ipc-%d", index)
		for _, base := range bases {
			if base == "" || seen[base] {
				continue
			}
			seen[base] = true
			conn, err := net.DialTimeout("unix", filepath.Join(base, name), 500*time.Millisecond)
			if err == nil {
				return conn, nil
			}
			last = err
		}
	}
	if last == nil {
		last = errors.New("discord ipc not found")
	}
	return nil, last
}
