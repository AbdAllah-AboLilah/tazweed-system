package main

// ============================================================
// 🧾 سجل الطباعة والأوراق المحفوظة — التجارب
// ============================================================
// ⚠️⚠️ التجربة الأهم هنا هي **حماية المسار**: اسم الورقة جاي من
// الصفحة، ولو اتحط في مسار على طول يبقى "../../settings.json"
// بيقرا أي ملف على الجهاز. باقي التجارب بتحرس السلوك اللي اتطلب.

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// صورة صغيرة سليمة — pngToESCPOS بتقراها زي أي ورقة.
func tinyPNGBase64(t *testing.T) string {
	t.Helper()
	img := image.NewGray(image.Rect(0, 0, 64, 40))
	for y := 0; y < 40; y++ {
		for x := 0; x < 64; x++ {
			img.SetGray(x, y, color.Gray{Y: 255})
		}
	}
	img.SetGray(3, 3, color.Gray{Y: 0})
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(b.Bytes())
}

func resetPrintLog(t *testing.T) {
	t.Helper()
	plMu.Lock()
	plData = nil
	plRead = true
	writePrintLogLocked()
	plMu.Unlock()
	os.RemoveAll(sheetsDir())
}

func doPrint(t *testing.T, body string) (int, printReply) {
	t.Helper()
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/print", strings.NewReader(body)))
	var out printReply
	json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func readLog(t *testing.T) printLogReply {
	t.Helper()
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/print/log", nil))
	var out printLogReply
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("الرد مش JSON: %v — %s", err, rec.Body.String())
	}
	return out
}

// ============================================================
// ⭐⭐⭐ اللي اتطبع بيتكتب — واللي فشل كمان
// ============================================================
// ⚠️⚠️ السطر الفاشل هو **نص الميزة**: الحالة اللي بتوجع هي "أنا
// دوست ومافيش ورقة طلعت". لو الفشل مااتسجّلش، السجل بيقول إن كله
// تمام وصاحب المحل واقف قدام طابعة ساكتة.
func TestPrintLogRecordsSuccessAndFailure(t *testing.T) {
	resetPrintLog(t)
	b64 := tinyPNGBase64(t)

	// نجاح: المسار البديل على لينكس بيكتب في ملف
	t.Setenv("TAZWEED_HELPER_OUT", t.TempDir())
	if code, out := doPrint(t, `{"printer":"جهاز-تجريبي","png":"`+b64+`","name":"ورقة تزويد — كريب"}`); code != 200 || !out.OK {
		t.Fatalf("الطبعة السليمة فشلت: %d %+v", code, out)
	}

	// فشل: من غير المتغيّر، printRaw بترجّع خطأ على لينكس
	t.Setenv("TAZWEED_HELPER_OUT", "")
	if code, _ := doPrint(t, `{"printer":"جهاز-تجريبي","png":"`+b64+`","name":"ورقة تزويد — حرير"}`); code == 200 {
		t.Fatalf("كان المفروض تفشل على لينكس من غير TAZWEED_HELPER_OUT")
	}

	log := readLog(t)
	if len(log.Entries) != 2 {
		t.Fatalf("المفروض سطرين، لقينا %d: %+v", len(log.Entries), log.Entries)
	}
	// ⚠️ الأحدث الأول
	bad, good := log.Entries[0], log.Entries[1]
	if bad.OK || bad.Error == "" {
		t.Fatalf("السطر الفاشل مااتسجّلش كفاشل: %+v", bad)
	}
	if !strings.Contains(bad.Name, "حرير") {
		t.Fatalf("السطر الفاشل مش بتاع الطبعة الفاشلة: %+v", bad)
	}
	if !good.OK || good.Sheet == "" {
		t.Fatalf("الطبعة السليمة مااتحفظتش ورقتها: %+v", good)
	}
	if !strings.Contains(good.Name, "كريب") {
		t.Fatalf("اسم الطبعة ضاع: %+v", good)
	}
}

// ============================================================
// ⭐⭐⭐ الورقة بتتطبع تاني من غير النظام
// ============================================================
// دي الميزة نفسها (م٤): الورقة بتخرج من الكمبيوتر من غير نت.
func TestSavedSheetReprintsWithoutTheSystem(t *testing.T) {
	resetPrintLog(t)
	t.Setenv("TAZWEED_HELPER_OUT", t.TempDir())
	b64 := tinyPNGBase64(t)
	if code, _ := doPrint(t, `{"printer":"جهاز-تجريبي","png":"`+b64+`","name":"ورقة تزويد — قطن"}`); code != 200 {
		t.Fatalf("الطبعة الأصلية فشلت: %d", code)
	}
	name := readLog(t).Entries[0].Sheet
	if name == "" {
		t.Fatal("الورقة مااتحفظتش أصلًا")
	}

	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/print/sheet/reprint",
		strings.NewReader(`{"name":"`+name+`","printer":"جهاز-تجريبي"}`)))
	if rec.Code != http.StatusOK {
		t.Fatalf("الطبعة التانية رجّعت %d: %s", rec.Code, rec.Body.String())
	}
	var out printReply
	json.Unmarshal(rec.Body.Bytes(), &out)
	if !out.OK || out.Bytes == 0 {
		t.Fatalf("الطبعة التانية مارجّعتش بايتات: %+v", out)
	}
	// ⚠️ والورقة نفسها بتفضل موجودة — عشان تتطبع تالت مرة
	if !sheetExists(name) {
		t.Fatal("الورقة اتشالت بعد ما اتطبعت تاني")
	}
	// والطبعة التانية بتتسجّل
	if n := len(readLog(t).Entries); n != 2 {
		t.Fatalf("الطبعة التانية مااتسجّلتش — %d سطر", n)
	}
}

// ============================================================
// ⭐⭐⭐ اسم الورقة اللي جاي من الصفحة مابيبنيش مسار
// ============================================================
// ⚠️⚠️ من غير الحماية دي، الصفحة تطلب "../settings.json" وتقرا
// إعدادات الجهاز. ونفس الحاجة في /print/sheet/reprint.
func TestSheetNameCannotEscapeTheFolder(t *testing.T) {
	bad := []string{
		"../settings.json", "..\\settings.json", "/etc/passwd",
		"sub/1.png", "..%2F1.png", "settings.json", "", "   ",
		"abc.png",     // مش أرقام
		"1.png.txt",   // مش .png
		"../../1.png", // برّه المجلد وباسم رقمي
	}
	for _, n := range bad {
		if p := sheetPath(n); p != "" {
			t.Fatalf("الاسم %q عدّى وطلّع مسار %q", n, p)
		}
	}
	if p := sheetPath("1790000000000.png"); p == "" {
		t.Fatal("الاسم السليم اترفض")
	}
	// والمسار السليم لازم يفضل جوه مجلد الأوراق
	if got := filepath.Dir(sheetPath("1790000000000.png")); got != sheetsDir() {
		t.Fatalf("المسار طلع برّه المجلد: %q", got)
	}
}

// ============================================================
// ⭐⭐ الورقة التجريبية ماتاكلش محل ورقة حقيقية
// ============================================================
func TestTestPrintIsLoggedButNotSaved(t *testing.T) {
	resetPrintLog(t)
	t.Setenv("TAZWEED_HELPER_OUT", t.TempDir())
	b64 := tinyPNGBase64(t)
	if code, _ := doPrint(t, `{"printer":"جهاز-تجريبي","png":"`+b64+`","name":"ورقة تجربة","test":true}`); code != 200 {
		t.Fatalf("ورقة التجربة فشلت: %d", code)
	}
	e := readLog(t).Entries[0]
	if e.Kind != "test" {
		t.Fatalf("النوع المفروض test: %+v", e)
	}
	if e.Sheet != "" {
		t.Fatalf("ورقة التجربة اتحفظت وهي مش المفروض: %+v", e)
	}
}

// ============================================================
// ⭐⭐ الأوراق القديمة بتتشال، والسجل مابيكبرش للأبد
// ============================================================
func TestSheetsAndLogAreTrimmed(t *testing.T) {
	resetPrintLog(t)
	dir := sheetsDir()
	os.MkdirAll(dir, 0o755)
	// أوراق أكتر من الحد بأسماء زمنية
	base := int64(1700000000000)
	for i := 0; i < maxSheets+5; i++ {
		os.WriteFile(filepath.Join(dir, itoa(base+int64(i))+".png"), []byte("x"), 0o644)
	}
	pruneSheets(dir)
	ents, _ := os.ReadDir(dir)
	if len(ents) != maxSheets {
		t.Fatalf("المفروض %d ورقة، فاضل %d", maxSheets, len(ents))
	}
	// ⚠️ والأقدم هو اللي طار مش الأحدث
	if _, err := os.Stat(filepath.Join(dir, itoa(base)+".png")); err == nil {
		t.Fatal("الأقدم لسه موجود — القص شال الغلط")
	}
	if _, err := os.Stat(filepath.Join(dir, itoa(base+int64(maxSheets+4))+".png")); err != nil {
		t.Fatal("الأحدث اتشال")
	}

	// والسجل
	resetPrintLog(t)
	for i := 0; i < maxPrintLog+7; i++ {
		addPrintLog(printLogEntry{Ms: base + int64(i), Kind: "label", OK: true, Name: "س" + itoa(int64(i))})
	}
	got := printLogEntries()
	if len(got) != maxPrintLog {
		t.Fatalf("السجل المفروض %d سطر، لقينا %d", maxPrintLog, len(got))
	}
	if got[0].Ms != base+int64(maxPrintLog+6) {
		t.Fatalf("الأحدث مش في الأول: %+v", got[0])
	}
}

// ============================================================
// ⭐⭐ ورقة اتشالت → السطر بتاعها مابيوريش زرار "اطبعها تاني"
// ============================================================
// ⚠️⚠️ من غير كده الصفحة بتوري زرار على ورقة مش موجودة، ودوسة
// بترجع خطأ — وده أسوأ من إن الزرار مايبانش أصلًا.
func TestVanishedSheetIsNotOfferedForReprint(t *testing.T) {
	resetPrintLog(t)
	addPrintLog(printLogEntry{Kind: "restock", OK: true, Name: "ورقة قديمة", Sheet: "1700000000001.png"})
	log := readLog(t)
	if len(log.Entries) != 1 {
		t.Fatalf("سطر واحد متوقّع: %+v", log.Entries)
	}
	if log.Entries[0].Sheet != "" {
		t.Fatalf("الورقة مش موجودة على القرص والسطر لسه بيقول إن فيه ملف: %+v", log.Entries[0])
	}
	if log.Sheets != 0 {
		t.Fatalf("عدّاد الأوراق غلط: %d", log.Sheets)
	}
}

// ============================================================
// ⭐ الورقة الضخمة بتتسجّل من غير ما تتحفظ
// ============================================================
func TestHugeSheetIsNotWrittenToDisk(t *testing.T) {
	resetPrintLog(t)
	if n := saveSheet(make([]byte, maxSheetBytes+1)); n != "" {
		t.Fatalf("ورقة أكبر من السقف اتحفظت: %q", n)
	}
	if n := saveSheet(nil); n != "" {
		t.Fatalf("ورقة فاضية اتحفظت: %q", n)
	}
}

// ⭐ الرقم القصير — ن٣
func TestShortCodeIsEightUpperChars(t *testing.T) {
	got := shortFP("b8f1a2c3d4e5f60718293a4b5c6d7e8f90")
	if got != "B8F1A2C3" {
		t.Fatalf("الرقم القصير طلع %q", got)
	}
	if shortFP("abc") != "" {
		t.Fatal("بصمة قصيرة المفروض ترجّع فاضي مش نص ناقص")
	}
	if shortFP("") != "" {
		t.Fatal("بصمة فاضية المفروض ترجّع فاضي")
	}
}

// ⭐ الوقت — عشان الأسماء تفضل بنفس الطول والترتيب يفضل زمني
func TestSheetNamesStayTheSameLength(t *testing.T) {
	a := itoa(nowMs())
	if len(a) != 13 {
		t.Fatalf("الوقت بالمللي المفروض 13 رقم، طلع %d (%s)", len(a), a)
	}
	_ = time.Now()
}

// ============================================================
// ⭐⭐ طبعتين في نفس المللي ثانية — الأحدث فوق
// ============================================================
// ⚠️⚠️ عطل حقيقي اتمسك في فحص: الترتيب كان sort.SliceStable على
// الوقت، والمتساويين كانوا بيفضلوا بترتيب **الكتابة** — يعني
// الأقدم فوق. وده بيحصل فعلًا: الطبعة وسطرها بيتكتبوا في نفس
// المللي، والملصقات بتتبعت على دفعات ورا بعض على طول.
func TestTwoPrintsInTheSameMillisecondShowNewestFirst(t *testing.T) {
	resetPrintLog(t)
	const ms = int64(1790000000000)
	addPrintLog(printLogEntry{Ms: ms, Kind: "label", OK: true, Name: "الأولى"})
	addPrintLog(printLogEntry{Ms: ms, Kind: "label", OK: true, Name: "التانية"})
	got := printLogEntries()
	if len(got) != 2 {
		t.Fatalf("سطرين متوقّعين: %+v", got)
	}
	if got[0].Name != "التانية" {
		t.Fatalf("الأقدم طلع فوق: %+v", got)
	}
}
