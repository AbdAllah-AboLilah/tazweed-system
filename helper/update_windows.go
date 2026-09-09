//go:build windows

package main

import (
	"os"
	"os/exec"
	"syscall"
)

func updateSupported() bool { return true }

// ⚠️ بيشغّل النسخة الجديدة **منفصلة تمامًا** عن دي، وبعدين دي بتقفل.
// من غير الفصل، قفل البرنامج القديم بيقفل الجديد معاه.
func restartSelf() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000008 | 0x00000200} // DETACHED_PROCESS | NEW_PROCESS_GROUP
	return cmd.Start()
}
