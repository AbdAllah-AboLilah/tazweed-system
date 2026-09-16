package main

// ============================================================
// 🤫 التحديث في الخلفية — من غير أي نافذة
// ============================================================
// اتبلّغ مرتين. المرة الأولى: "لما اضغط علي تحديث النظام المساعد من
// الهاتف ميفتحش الواجهة بعد ما البرنامج المساعد يتحدث". والتانية بعد
// الإصلاح الأول: "وراجع بردوا عمليت تحديث النظام المساعد في الخلفية
// لانها مش مظبوط".
//
// ⚠️⚠️ والتانية كانت محقة: الإصلاح الأول كان في restartSelf، واللي
// بيشغّل النسخة الجديدة هو **البرنامج القديم** — فالعلم مابينفعش غير
// من التحديثة اللي بعد اللي ركّبت الإصلاح.
//
// فالنسخة الجديدة بقت تكتشف بنفسها من وجود <البرنامج>.old + تاريخ
// البرنامج نفسه. الفحوص دي على الاكتشاف ده.

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// ⚠️⚠️ الفحوص بتنده startedByUpdateAt **الحقيقية** من update.go،
// مش نسخة منها هنا. النسخة كانت معناها إن أي غلط في الكود الحقيقي
// يعدّي والفحص يفضل أخضر — وده اتجرّب فعلًا واتمسك.

func makeExe(t *testing.T, age time.Duration, withOld bool) string {
	t.Helper()
	dir := t.TempDir()
	exe := filepath.Join(dir, "tazweed-helper.exe")
	if err := os.WriteFile(exe, []byte("MZ"), 0o755); err != nil {
		t.Fatal(err)
	}
	when := time.Now().Add(-age)
	if err := os.Chtimes(exe, when, when); err != nil {
		t.Fatal(err)
	}
	if withOld {
		// ⚠️ بتاريخ **قديم** عن قصد: os.Rename بتنقل تاريخ النسخة
		// القديمة معاها، فلو الكود بيقرا تاريخ .old هيغلط.
		old := exe + ".old"
		if err := os.WriteFile(old, []byte("MZ"), 0o755); err != nil {
			t.Fatal(err)
		}
		longAgo := time.Now().Add(-30 * 24 * time.Hour)
		if err := os.Chtimes(old, longAgo, longAgo); err != nil {
			t.Fatal(err)
		}
	}
	return exe
}

// ⭐⭐⭐⭐⭐ الحالة اللي اتبلّغت: اتحدّث دلوقتي → مافيش نافذة
func TestDetectsFreshUpdate(t *testing.T) {
	exe := makeExe(t, 3*time.Second, true)
	if !startedByUpdateAt(exe) {
		t.Fatal("مااكتشفش إنه اتحدّث — النافذة هتفتح في وش المستخدم")
	}
}

// ⚠️⚠️ والتنصيب اليدوي **لازم** يفتح النافذة: هو واقف بيدوس دوبل كليك
// ومستني حاجة تحصل. السكوت هنا معناه "البرنامج مااشتغلش".
func TestManualInstallStillOpensWindow(t *testing.T) {
	exe := makeExe(t, 3*time.Second, false) // مافيش .old
	if startedByUpdateAt(exe) {
		t.Fatal("سكت على تنصيب يدوي — المستخدم هيفتكر إنه مااشتغلش")
	}
}

// ⚠️ ملف .old فاضل من تحديث قديم (مسحه فشل) مايخلّيش كل فتحة صامتة
func TestStaleOldFileDoesNotSilenceForever(t *testing.T) {
	exe := makeExe(t, 48*time.Hour, true)
	if startedByUpdateAt(exe) {
		t.Fatal("فضل ساكت بسبب ملف قديم — كل فتحة هتبقى صامتة")
	}
}

// ⚠️⚠️ الترتيب: cleanupOldBinary بتمسح الدليل، فلازم تتنده **بعد**
// الاكتشاف. لو اتقلبوا، الاكتشاف عمره ما هيلاقي حاجة.
func TestDetectionRunsBeforeCleanup(t *testing.T) {
	src, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatal(err)
	}
	s := string(src)
	iDetect := indexOf(s, "startedByUpdate()")
	iClean := indexOf(s, "cleanupOldBinary()")
	if iDetect < 0 || iClean < 0 {
		t.Fatalf("مالقيتش النداءين: %d %d", iDetect, iClean)
	}
	if iDetect > iClean {
		t.Fatal("التنضيف قبل الاكتشاف — الاكتشاف عمره ما هيلاقي الدليل")
	}
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// ============================================================
// 📦 مايحمّلش وهو أصلًا على آخر نسخة
// ============================================================
// اتبلّغ بالنص: "لما بضغط علي تحديث المساعد بيرجع ينزل اخر نسخة حتي
// لو كانت علي الجهاز اخر نسخة بردوا يعني متحدثه".
//
// ⚠️⚠️ والتكلفة مش التنزيل بس: البرنامج كان بيقفل ويفتح على **كل**
// جهاز مقابل لا حاجة. تلات أجهزة كلهم على آخر نسخة = 21 ميجا وتلات
// برامج بتعيد التشغيل في وسط يوم شغل.
func withFakeGitHub(t *testing.T, latest string) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/VERSION") {
			fmt.Fprintf(w, "%s\n%s\n", latest, strings.Repeat("a", 64))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	oldInfo := updateInfoURL
	updateInfoURL = srv.URL + "/VERSION"
	t.Cleanup(func() {
		updateInfoURL = oldInfo
		srv.Close()
	})
}

func TestUpdateSkipsWhenAlreadyLatest(t *testing.T) {
	withFakeGitHub(t, version)
	want, _, err := shouldDownload(false)
	if err != nil {
		t.Fatalf("رجّع خطأ: %v", err)
	}
	if want {
		t.Fatal("قرر ينزّل وهو على آخر نسخة — ده العطل اللي اتبلّغ")
	}
}

// ⚠️ وفيه نسخة أحدث = بينزّل عادي (مانكسرناش التحديث وإحنا بنمنع
// التكرار).
func TestUpdateStillRunsWhenNewer(t *testing.T) {
	withFakeGitHub(t, "99.0.0")
	want, _, err := shouldDownload(false)
	if err != nil {
		t.Fatalf("رجّع خطأ: %v", err)
	}
	if !want {
		t.Fatal("مانزّلش وفيه نسخة أحدث")
	}
}

// ⚠️ وإعادة التركيب بالإجبار لازم تفضل شغّالة: من غيرها اللي نسخته
// بايظة وهو على آخر رقم مالوش أي طريقة يصلّح بيها.
func TestForceReinstallStillDownloads(t *testing.T) {
	withFakeGitHub(t, version)
	want, _, err := shouldDownload(true)
	if err != nil {
		t.Fatalf("رجّع خطأ: %v", err)
	}
	if !want {
		t.Fatal("الإجبار مانزّلش")
	}
}

// ⚠️ والرد بيقول **هل اتحدّث فعلًا** — الواجهة بتقرا منه، ولو
// مابيقولش، هتكتب "اتحدّث وبيقفل ويفتح" وهو مانزّلش حاجة.
func TestApplyReplySaysWhetherItUpdated(t *testing.T) {
	m, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatal(err)
	}
	s := string(m)
	if !strings.Contains(s, `"updated": updated`) {
		t.Fatal("الرد مش بيقول اتحدّث ولا لأ")
	}
	if !strings.Contains(s, "if !updated {") {
		t.Fatal("بيعيد التشغيل حتى لو مانزّلش حاجة")
	}
}
