//go:build windows

package main

// ============================================================
// 🚀 يشتغل مع الويندوز — في الخلفية من غير ما يفتح حاجة
// ============================================================
// اتطلب بالنص: "اول م جهاز الكمبيوتر يشتغل البرنامج المساعد يشتغل
// معاه بس من غير ما يفتح شاشة المتصفح يفتح بس ويبقي في الخلفيه
// ويختفي في ايقونة اللي جنب الساعة".
//
// ⚠️ بنستخدم `reg.exe` بتاع الويندوز نفسه بدل مكتبة سجل خارجية:
// مافيش اعتماد زيادة، والأمر واضح ويتقرا.
//
// ⚠️⚠️ ومفتاح HKCU (المستخدم الحالي) مش HKLM: HKLM محتاج صلاحيات
// مدير، والبرنامج المفروض يشتغل بدوبل كليك عادي.

import (
	"os"
	"os/exec"
	"strings"
	"syscall"
)

const runKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
const runName = "TazweedHelper"

func hidden(c *exec.Cmd) *exec.Cmd {
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return c
}

func autostartEnabled() bool {
	out, err := hidden(exec.Command("reg", "query", runKey, "/v", runName)).Output()
	return err == nil && strings.Contains(string(out), runName)
}

// ⚠️ العلامة `--startup` هي اللي بتخلي البرنامج **مايفتحش المتصفح**
// لما الويندوز يشغّله. من غيرها كل مرة تفتح الكمبيوتر هتلاقي صفحة
// فاتحة في وشك — وده بالظبط اللي اتطلب إنه مايحصلش.
func setAutostart(on bool) error {
	if !on {
		err := hidden(exec.Command("reg", "delete", runKey, "/v", runName, "/f")).Run()
		if !autostartEnabled() {
			return nil // اتشال (أو مكانش موجود أصلًا)
		}
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	// الاقتباس عشان المسار اللي فيه مسافات
	val := `"` + exe + `" --startup`
	return hidden(exec.Command("reg", "add", runKey, "/v", runName, "/t", "REG_SZ", "/d", val, "/f")).Run()
}
