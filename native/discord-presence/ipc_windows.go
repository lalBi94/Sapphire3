//go:build windows

package main

import (
	"fmt"
	"os"
	"syscall"
)

// Essaie les dix pipes Discord connus, sans jamais ouvrir de fenêtre.
func connectDiscord() (stream, error) {
	if override := os.Getenv("SAPPHIRE_DISCORD_IPC_PATH"); override != "" {
		return openPipe(override)
	}
	var last error
	for index := 0; index < 10; index++ {
		name := fmt.Sprintf(`\\.\pipe\discord-ipc-%d`, index)
		conn, err := openPipe(name)
		if err == nil {
			return conn, nil
		}
		last = err
	}
	if last == nil {
		last = fmt.Errorf("discord ipc not found")
	}
	return nil, last
}

// Ouvre un named pipe Discord ou un chemin de test explicite.
func openPipe(name string) (stream, error) {
	pointer, err := syscall.UTF16PtrFromString(name)
	if err != nil {
		return nil, err
	}
	handle, err := syscall.CreateFile(
		pointer,
		syscall.GENERIC_READ|syscall.GENERIC_WRITE,
		0,
		nil,
		syscall.OPEN_EXISTING,
		syscall.FILE_ATTRIBUTE_NORMAL,
		0,
	)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(handle), name), nil
}
