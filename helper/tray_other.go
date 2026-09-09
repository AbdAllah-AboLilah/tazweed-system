//go:build !windows

package main

func hideConsoleWindow()       {}
func startTray(onQuit func()) {}
