package main

// ============================================================
// 📦 ملف الأصناف — التجارب
// ============================================================
// ⚠️ التجربة الأهم هنا هي المسار **اللي بين علامتين اقتباس**: ده
// اللي بيطلع من "نسخ كمسار" في الويندوز، وهو أكتر طريقة صاحب المحل
// هياخد بيها المسار. لو اتحفظ زي ما هو، البرنامج هيقول "الملف مش
// موجود" والمستخدم بيبص على مسار مكتوب صح ومش فاهم.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func postJSON(t *testing.T, h func(http.ResponseWriter, *http.Request), path, body string, out interface{}) {
	t.Helper()
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("%s رجّع %d: %s", path, rec.Code, rec.Body.String())
	}
	if out != nil {
		if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
			t.Fatalf("الرد مش JSON: %v — %s", err, rec.Body.String())
		}
	}
}

func TestQuotedWindowsPathStillFindsTheFile(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "List.xlsx")
	if err := os.WriteFile(f, []byte("اصناف"), 0o644); err != nil {
		t.Fatal(err)
	}
	var st productsFileState
	// بالظبط زي ما "نسخ كمسار" بيحطه
	postJSON(t, handleProductsFile, "/products/file",
		`{"path":`+jsonStr(`"`+f+`"`)+`}`, &st)
	if !st.Exists {
		t.Fatalf("المسار اللي جاي بعلامتين اقتباس ماتلاقاش: %+v", st)
	}
	if st.Path != f {
		t.Fatalf("المسار المحفوظ لسه فيه علامات: %q", st.Path)
	}
	if st.Fingerprint == "" {
		t.Fatal("مافيش بصمة للملف")
	}
}

func jsonStr(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func TestSavingPathAloneDoesNotTurnOffAutoUpload(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "a.xlsx")
	os.WriteFile(f, []byte("x"), 0o644)

	var st productsFileState
	postJSON(t, handleProductsFile, "/products/file", `{"autoUpload":true}`, &st)
	if !st.AutoUpload {
		t.Fatal("الرفع التلقائي مااتحفظش")
	}
	// الصفحة بتبعت المسار لوحده — والمفتاح مالوش دعوة
	postJSON(t, handleProductsFile, "/products/file", `{"path":`+jsonStr(f)+`}`, &st)
	if !st.AutoUpload {
		t.Fatal("حفظ المسار لوحده طفّى الرفع التلقائي")
	}
	// والعكس: تغيير المفتاح مايضيّعش المسار
	postJSON(t, handleProductsFile, "/products/file", `{"autoUpload":false}`, &st)
	if st.Path != f {
		t.Fatalf("تغيير المفتاح ضيّع المسار: %q", st.Path)
	}
}

func TestMissingFileSaysWhyInArabic(t *testing.T) {
	var st productsFileState
	postJSON(t, handleProductsFile, "/products/file",
		`{"path":`+jsonStr(filepath.Join(t.TempDir(), "مافيش.xlsx"))+`}`, &st)
	if st.Exists || st.Error == "" {
		t.Fatalf("المفروض يقول إن الملف مش موجود: %+v", st)
	}

	// وده مجلد مش ملف
	postJSON(t, handleProductsFile, "/products/file", `{"path":`+jsonStr(t.TempDir())+`}`, &st)
	if st.Exists || !strings.Contains(st.Error, "مجلد") {
		t.Fatalf("المفروض يفرّق بين المجلد والملف: %+v", st)
	}
}

// ⚠️ النظام بيقرا JSON. لو الملف مش موجود ورجّعنا صفحة خطأ HTML،
// الخطأ اللي هيبان عنده غامض ومالوش علاقة بالسبب.
func TestRawSaysNoFileAsJSONNotHTML(t *testing.T) {
	postJSON(t, handleProductsFile, "/products/file", `{"path":""}`, nil)
	rec := httptest.NewRecorder()
	handleProductsFileRaw(rec, httptest.NewRequest(http.MethodGet, "/products/file/raw", nil))
	if rec.Code != http.StatusConflict {
		t.Fatalf("المفروض 409 مش %d", rec.Code)
	}
	var j map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &j); err != nil || j["error"] == "" {
		t.Fatalf("الرد لازم يبقى JSON فيه السبب: %s", rec.Body.String())
	}
}

func TestRawSendsTheFileWithItsFingerprint(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "b.xlsx")
	os.WriteFile(f, []byte("محتوى الملف"), 0o644)
	var st productsFileState
	postJSON(t, handleProductsFile, "/products/file", `{"path":`+jsonStr(f)+`}`, &st)

	rec := httptest.NewRecorder()
	handleProductsFileRaw(rec, httptest.NewRequest(http.MethodGet, "/products/file/raw", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("رجّع %d", rec.Code)
	}
	if rec.Body.String() != "محتوى الملف" {
		t.Fatalf("المحتوى غلط: %q", rec.Body.String())
	}
	if got := rec.Header().Get("X-Tazweed-Fingerprint"); got != st.Fingerprint {
		t.Fatalf("البصمة في الترويسة (%q) مش نفس اللي في الحالة (%q)", got, st.Fingerprint)
	}
}

// ⚠️⚠️ البصمة هي اللي "اتغيّر ولا لأ" كله مبني عليها. لو ماتغيّرتش
// لما المحتوى يتغيّر، الرفع التلقائي عمره ما هيشتغل.
func TestFingerprintChangesWhenFileChanges(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "c.xlsx")
	os.WriteFile(f, []byte("نسخة ١"), 0o644)
	var a, b productsFileState
	postJSON(t, handleProductsFile, "/products/file", `{"path":`+jsonStr(f)+`}`, &a)

	os.WriteFile(f, []byte("نسخة ٢ فيها أصناف أكتر"), 0o644)
	rec := httptest.NewRecorder()
	handleProductsFile(rec, httptest.NewRequest(http.MethodGet, "/products/file", nil))
	json.Unmarshal(rec.Body.Bytes(), &b)
	if a.Fingerprint == "" || a.Fingerprint == b.Fingerprint {
		t.Fatalf("البصمة مااتغيّرتش مع إن الملف اتغيّر: %q", a.Fingerprint)
	}
}

// ⚠️ الصفحة والنظام الاتنين بيقروا الحالة من /status كمان — ولو
// الحقل مش هناك، التليفون مش هيعرف إن الجهاز ده عليه ملف.
func TestStatusCarriesTheProductsFile(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "d.xlsx")
	os.WriteFile(f, []byte("x"), 0o644)
	postJSON(t, handleProductsFile, "/products/file",
		`{"path":`+jsonStr(f)+`,"autoUpload":true}`, nil)

	rec := httptest.NewRecorder()
	handleStatus(rec, httptest.NewRequest(http.MethodGet, "/status", nil))
	var s statusReply
	if err := json.Unmarshal(rec.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if s.ProductsFile != f || !s.ProductsAutoUpload {
		t.Fatalf("/status مش شايل ملف الأصناف: %+v", s)
	}
}
