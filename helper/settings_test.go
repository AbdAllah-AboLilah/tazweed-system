package main

// ============================================================
// 💾 الحفظ من الصفحة مايمسحش اللي مش بيبعته
// ============================================================
// ⚠️⚠️ عطل حقيقي عاش من v1.8.0: الصفحة بتبعت الطابعتين والاسم
// والمعايرة بس، والحفظ كان بيستبدل الملف كله بالكائن اللي جاي —
// فالتصاميم واختيارات أنواع الملصق كانت **بتتمسح في سكوت** مع كل
// دوسة على "احفظ الإعدادات".
//
// يعني تظبط تصميمك بالمليمتر، تروح تغيّر اسم الجهاز، يرجع الافتراضي
// ومحدش يعرف ليه.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSavingSettingsKeepsWhatThePageDoesNotSend(t *testing.T) {
	// حالة كاملة زي اللي بتبقى عند المستخدم بعد ما يظبط
	d := defaultDesign()
	d.Name = "تصميمي"
	if err := saveDesign(d); err != nil {
		t.Fatalf("مقدرتش أحفظ تصميم: %v", err)
	}
	if err := setDesignRole(roleNormal, "تصميمي"); err != nil {
		t.Fatalf("مقدرتش أختار الدور: %v", err)
	}
	before := getSettings()
	if len(before.Designs) == 0 || before.DesignRoles[roleNormal] != "تصميمي" {
		t.Fatalf("التجهيز نفسه فشل: %+v", before)
	}
	id := machineID()

	// الصفحة بتبعت الحقول بتاعتها **بس** — زي ما هي بالحرف
	body := `{"restockPrinter":"P80","labelPrinter":"P235","deviceName":"كاشير","labelGapMm":3,"labelDirection":0,"labelFlip":true}`
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/settings", strings.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("الحفظ رجّع %d: %s", rec.Code, rec.Body.String())
	}

	after := getSettings()
	// ⚠️ اللي اتبعت لازم يتكتب
	if after.LabelPrinter != "P235" || after.DeviceName != "كاشير" {
		t.Fatalf("اللي اتبعت مااتحفظش: %+v", after)
	}
	// ⚠️⚠️ واللي مااتبعتش لازم **يفضل مكانه**
	if len(after.Designs) != len(before.Designs) {
		t.Fatalf("التصاميم اتمسحت: كانت %d وبقت %d", len(before.Designs), len(after.Designs))
	}
	if after.DesignRoles[roleNormal] != "تصميمي" {
		t.Fatalf("اختيار نوع الملصق اتمسح: %+v", after.DesignRoles)
	}
	if after.MachineID != id {
		t.Fatalf("معرّف الماكينة اتغيّر: %q → %q", id, after.MachineID)
	}
}

// ⚠️ والقيمة اللي بتتبعت **false** لازم تتكتب فعلًا — مش تتجاهل
// عشان هي الصفر. غير كده، مفتاح بيتقفل من الصفحة مابيتقفلش.
func TestSavingSettingsCanTurnAFlagOff(t *testing.T) {
	s := getSettings()
	s.LabelFlip = true
	if err := saveSettings(s); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/settings",
		strings.NewReader(`{"labelFlip":false}`)))
	if rec.Code != http.StatusOK {
		t.Fatalf("الكود %d", rec.Code)
	}
	if getSettings().LabelFlip {
		t.Fatal("المفتاح مااتقفلش")
	}
}

// ============================================================
// 📦 نقل الإعدادات — الهوية **مابتتنقلش**
// ============================================================
// ⚠️⚠️ لو معرّف الماكينة اتنقل مع الملف، الجهازين هيبقوا **جهاز
// واحد** في النظام: نفس المعرّف = نفس الكارت، وكل واحد بيمسح نبضة
// التاني. وده بالظبط العطل اللي المعرّف اتعمل عشان يمنعه.
func TestExportDropsTheMachineIdentity(t *testing.T) {
	s := getSettings()
	s.MachineID = "abc-123"
	s.DeviceName = "كمبيوتر الكاشير"
	s.LabelPrinter = "P235"
	if err := saveSettings(s); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/settings/export", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("الكود %d", rec.Code)
	}
	var out settings
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("الملف مش JSON: %v", err)
	}
	if out.MachineID != "" || out.DeviceName != "" {
		t.Fatalf("الهوية اتصدّرت مع الملف: %+v", out)
	}
	// ⚠️ واللي المفروض ينتقل فعلًا لازم يبقى موجود، وإلا الملف مالوش لازمة.
	if out.LabelPrinter != "P235" {
		t.Fatalf("الإعدادات مااتصدّرتش: %+v", out)
	}
}

// ⚠️ والاستيراد بيسيب هوية الجهاز بتاعته مهما كان في الملف.
func TestImportKeepsThisMachineIdentity(t *testing.T) {
	s := getSettings()
	s.MachineID = "mine-1"
	s.DeviceName = "كمبيوتر المخزن"
	if err := saveSettings(s); err != nil {
		t.Fatal(err)
	}
	body := `{"machineId":"other-9","deviceName":"كمبيوتر تاني","labelPrinter":"XP-1","labelGapMm":4}`
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/settings/import", strings.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("الكود %d", rec.Code)
	}
	after := getSettings()
	if after.MachineID != "mine-1" || after.DeviceName != "كمبيوتر المخزن" {
		t.Fatalf("الهوية اتبدّلت من الملف: %q / %q", after.MachineID, after.DeviceName)
	}
	if after.LabelPrinter != "XP-1" {
		t.Fatalf("الإعدادات مااتحمّلتش: %+v", after)
	}
}
