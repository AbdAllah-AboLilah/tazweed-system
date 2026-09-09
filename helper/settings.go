package main

// ============================================================
// 💾 اختيار الطابعتين — بيتحفظ على الجهاز
// ============================================================
// اتطلب بالنص: "عاوزين نعمل خانة ل طابعة وروقة التزويد وواحده ل حقل
// ل طابعة الملصق ويحفظ الاختيار".
//
// ⚠️ الحفظ جنب البرنامج نفسه (settings.json) مش في مكان النظام:
// البرنامج بيتنقل بملف واحد، فالإعداد لازم يمشي معاه. ولو المجلد
// مقفول للكتابة، بنرجع لمجلد بيانات المستخدم.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type settings struct {
	RestockPrinter string `json:"restockPrinter"`
	LabelPrinter   string `json:"labelPrinter"`
}

var (
	setMu   sync.RWMutex
	setData settings
)

func settingsPath() string {
	if exe, err := os.Executable(); err == nil {
		p := filepath.Join(filepath.Dir(exe), "settings.json")
		// ⚠️ بنجرّب الكتابة فعلًا: المجلد ممكن يكون Program Files
		// والويندوز بيمنع الكتابة فيه من غير صلاحيات مدير.
		if f, err := os.OpenFile(p, os.O_CREATE|os.O_APPEND, 0o644); err == nil {
			f.Close()
			return p
		}
	}
	dir, err := os.UserConfigDir()
	if err != nil {
		return "settings.json"
	}
	d := filepath.Join(dir, "tazweed-helper")
	os.MkdirAll(d, 0o755)
	return filepath.Join(d, "settings.json")
}

func loadSettings() {
	setMu.Lock()
	defer setMu.Unlock()
	b, err := os.ReadFile(settingsPath())
	if err != nil {
		return
	}
	json.Unmarshal(b, &setData) // الملف البايظ = إعدادات فاضية، مش وقوع
}

func getSettings() settings {
	setMu.RLock()
	defer setMu.RUnlock()
	return setData
}

func saveSettings(s settings) error {
	setMu.Lock()
	setData = s
	setMu.Unlock()
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(settingsPath(), b, 0o644)
}

// ⚠️ الطابعة المطلوبة أولًا، وبعدين المحفوظة. كده النظام يقدر يبعت
// اسم طابعة صريح ويكسب، والصفحة تقدر تسيبه فاضي فيستخدم المحفوظ.
func pickPrinter(requested, kind string) string {
	if requested != "" {
		return requested
	}
	s := getSettings()
	if kind == "label" {
		return s.LabelPrinter
	}
	return s.RestockPrinter
}
