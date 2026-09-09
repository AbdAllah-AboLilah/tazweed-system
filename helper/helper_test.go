package main

// فحوصات المساعد
// ============================================================
// ⚠️⚠️ أخطر حاجة في البرنامج ده **مش** الطباعة — الأمان.
// البرنامج بيفتح باب على الجهاز، وأي صفحة في نفس المتصفح ممكن تحاول
// تطبع منه. الفحوصات اللي تحت عن ده أكتر من أي حاجة تانية.

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func makePNG(t *testing.T, w, h int, black bool) []byte {
	t.Helper()
	img := image.NewGray(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := color.Gray{Y: 255}
			if black {
				c = color.Gray{Y: 0}
			}
			img.SetGray(x, y, c)
		}
	}
	var b bytes.Buffer
	if err := png.Encode(&b, img); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

// ============================================================
// التحويل
// ============================================================
func TestRasterShape(t *testing.T) {
	raw := makePNG(t, 576, 300, true)
	out, w, h, err := pngToESCPOS(raw, true)
	if err != nil {
		t.Fatal(err)
	}
	if w != 576 || h != 300 {
		t.Fatalf("مقاس غلط: %dx%d", w, h)
	}
	// لازم يبدأ بتهيئة الطابعة
	if !bytes.HasPrefix(out, []byte{0x1B, 0x40}) {
		t.Fatal("مافيش ESC @ في الأول")
	}
	// ⚠️ الصورة 300 صف والشريحة 128 → لازم **تلات** أوامر رستر.
	// لو بقى أمر واحد، يبقى حد شال التقسيم — وده اللي بيخلي الطابعة
	// تقع أو تطبع نص الورقة.
	if n := bytes.Count(out, []byte{0x1D, 0x76, 0x30, 0x00}); n != 3 {
		t.Fatalf("عدد أوامر الرستر = %d، المفروض 3", n)
	}
	// والقص في الآخر، والتقديم قبله
	if !bytes.HasSuffix(out, feedAndCut()) {
		t.Fatal("مافيش تقديم وقص في الآخر")
	}
	fi := bytes.LastIndex(out, []byte{0x1B, 0x64})
	ci := bytes.LastIndex(out, []byte{0x1D, 0x56})
	if fi < 0 || ci < 0 || fi > ci {
		t.Fatal("التقديم لازم يكون قبل القص")
	}
}

func TestNoCutWhenAsked(t *testing.T) {
	out, _, _, err := pngToESCPOS(makePNG(t, 64, 10, true), false)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(out, []byte{0x1D, 0x56}) {
		t.Fatal("اتقص رغم إننا قلنا لأ")
	}
}

// ⚠️ الأبيض والأسود لازم يطلعوا **مختلفين فعلًا**. من غير الفحص ده،
// لو التحويل بيطلّع أصفار دايمًا كل الفحوصات التانية بتعدّي وهي فاضية.
func TestBlackAndWhiteDiffer(t *testing.T) {
	blk, _, _, _ := pngToESCPOS(makePNG(t, 64, 8, true), false)
	wht, _, _, _ := pngToESCPOS(makePNG(t, 64, 8, false), false)
	if bytes.Equal(blk, wht) {
		t.Fatal("الأبيض والأسود طلعوا نفس البايتات")
	}
	body := blk[len(blk)-64:]
	if !bytes.Contains(body, []byte{0xFF}) {
		t.Fatal("الأسود المفروض يطلّع بِتّات مليانة")
	}
	if bytes.Contains(wht[len(wht)-64:], []byte{0xFF}) {
		t.Fatal("الأبيض المفروض ما يطلّعش بِتّات مليانة")
	}
}

// ⚠️ أعرض من رأس الطباعة = الطابعة بتقص من اليمين **في صمت**.
// الرفض أحسن من ورقة ناقصة محدش واخد باله منها.
func TestTooWideRejected(t *testing.T) {
	if _, _, _, err := pngToESCPOS(makePNG(t, 700, 10, true), true); err == nil {
		t.Fatal("قبل صورة أعرض من رأس الطباعة")
	}
}

func TestBadPNG(t *testing.T) {
	if _, _, _, err := pngToESCPOS([]byte("مش صورة"), true); err == nil {
		t.Fatal("قبل بيانات مش صورة")
	}
}

// ============================================================
// ⚠️⚠️ الأمان
// ============================================================
func post(t *testing.T, mux *http.ServeMux, path, origin, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	return w
}

func TestOriginLockedDown(t *testing.T) {
	mux := newServer()
	bad := []string{
		"https://evil.example",                         // موقع تاني
		"http://abdallah-abolilah.github.io",           // نفس الاسم بس http
		"https://abdallah-abolilah.github.io.evil.com", // بادئة مخادعة
		"null",
	}
	for _, o := range bad {
		if w := post(t, mux, "/print", o, "{}"); w.Code != http.StatusForbidden {
			t.Fatalf("مصدر %q اتقبل (كود %d)", o, w.Code)
		}
	}
	// ⚠️ (تحقّق) والمصدر الصح لازم **يعدّي** — وإلا الفحص اللي فوق
	// بيعدّي لأن كل حاجة مرفوضة، مش لأن القفل شغّال صح.
	if w := post(t, mux, "/print", "https://abdallah-abolilah.github.io", `{"printer":""}`); w.Code == http.StatusForbidden {
		t.Fatal("المصدر الصح اترفض")
	}
}

// ⚠️⚠️ الطلب من غير Origin لازم **يعدّي** — ده طلب صفحة التجربة
// بتاعة البرنامج نفسه. المتصفح مابيبعتش Origin في GET من نفس العنوان،
// وأول نسخة كانت بترفضه فالصفحة طلّعت «غير مسموح» وهي بتاعتنا.
func TestSameOriginNoHeaderAllowed(t *testing.T) {
	mux := newServer()
	r := httptest.NewRequest(http.MethodGet, "/status", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("طلب صفحة التجربة اترفض: %d — %s", w.Code, w.Body.String())
	}
}

// ⚠️ بس لو المتصفح قال صراحةً إن الطلب من موقع تاني، بنرفض حتى من
// غير Origin — ده اللي بيمنع صفحة تحاول تتحايل بإخفاء الترويسة.
func TestCrossSiteWithoutOriginRejected(t *testing.T) {
	mux := newServer()
	for _, site := range []string{"cross-site", "same-site"} {
		r := httptest.NewRequest(http.MethodGet, "/status", nil)
		r.Header.Set("Sec-Fetch-Site", site)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != http.StatusForbidden {
			t.Fatalf("Sec-Fetch-Site=%s اتقبل (%d)", site, w.Code)
		}
	}
	// ⚠️ (تحقّق) و same-origin لازم يعدّي
	r := httptest.NewRequest(http.MethodGet, "/status", nil)
	r.Header.Set("Sec-Fetch-Site", "same-origin")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("same-origin اترفض: %d", w.Code)
	}
}

// ⚠️ من غير الترويسة دي كروم بيمنع النداء على العناوين المحلية،
// والبرنامج يبان "مش شغّال" وهو شغّال.
func TestPrivateNetworkHeader(t *testing.T) {
	mux := newServer()
	r := httptest.NewRequest(http.MethodOptions, "/print", nil)
	r.Header.Set("Origin", "https://abdallah-abolilah.github.io")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusNoContent {
		t.Fatalf("preflight رجع %d", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Fatal("مافيش Access-Control-Allow-Private-Network")
	}
	if w.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Fatal("مافيش Access-Control-Allow-Origin")
	}
}

func TestStatusShape(t *testing.T) {
	mux := newServer()
	r := httptest.NewRequest(http.MethodGet, "/status", nil)
	r.Header.Set("Origin", "https://abdallah-abolilah.github.io")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status رجع %d", w.Code)
	}
	var s statusReply
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if s.App != "tazweed-helper" || s.Version == "" {
		t.Fatalf("رد غريب: %+v", s)
	}
}

func TestPrintValidation(t *testing.T) {
	mux := newServer()
	ok := "https://abdallah-abolilah.github.io"
	// من غير طابعة
	if w := post(t, mux, "/print", ok, `{"png":"AAAA"}`); w.Code != http.StatusBadRequest {
		t.Fatalf("قبل طلب من غير طابعة: %d", w.Code)
	}
	// base64 بايظة
	if w := post(t, mux, "/print", ok, `{"printer":"XP-80C","png":"!!!"}`); w.Code != http.StatusBadRequest {
		t.Fatalf("قبل base64 بايظة: %d", w.Code)
	}
	// ⚠️ الترويسة data: لو جت بالغلط لازم تتشال مش تفشل
	img := base64.StdEncoding.EncodeToString(makePNG(t, 64, 8, true))
	body := `{"printer":"XP-80C","png":"data:image/png;base64,` + img + `"}`
	w := post(t, mux, "/print", ok, body)
	if w.Code == http.StatusBadRequest {
		t.Fatalf("الترويسة data: كسرت الطلب: %s", w.Body.String())
	}
}

// ⚠️ صفحة التجربة لازم تتعرض، **ومصدرها** لازم يكون مسموح — وإلا
// الصفحة تفتح وزرار الطباعة يترفض، وهي أصلًا اتعملت عشان نجرّب.
func TestSelfTestPage(t *testing.T) {
	mux := newServer()
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("الصفحة رجعت %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "مساعد التزويد") {
		t.Fatal("محتوى الصفحة غلط")
	}
	if !originAllowed("http://127.0.0.1:7770") {
		t.Fatal("مصدر صفحة التجربة نفسها مرفوض")
	}
	// وأي مسار تاني = 404 مش الصفحة
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, httptest.NewRequest(http.MethodGet, "/haga", nil))
	if w2.Code != http.StatusNotFound {
		t.Fatalf("مسار غريب رجع %d", w2.Code)
	}
}

// ============================================================
// التحديث الذاتي
// ============================================================
// ⚠️ المقارنة النصّية بتغلط هنا: "1.9.0" أكبر من "1.10.0" كنص، وهو
// العكس. الفحص ده بيمسك الغلطة دي بالذات.
func TestVersionCompare(t *testing.T) {
	cases := []struct {
		a, b string
		want bool
	}{
		{"1.0.1", "1.0.0", true},
		{"1.10.0", "1.9.0", true}, // ⚠️ دي اللي بتكشف المقارنة النصّية
		{"2.0.0", "1.99.99", true},
		{"1.0.0", "1.0.0", false},
		{"1.0.0", "1.0.1", false},
		{"1.0", "1.0.0", false},
	}
	for _, c := range cases {
		if got := newerThan(c.a, c.b); got != c.want {
			t.Fatalf("newerThan(%q,%q)=%v المفروض %v", c.a, c.b, got, c.want)
		}
	}
}

// ⚠️ التحديث لازم يكون POST: حاجة بتستبدل البرنامج نفسه مايصحّش
// تتنفّذ بمجرد إن حد يفتح رابط.
func TestUpdateApplyNeedsPost(t *testing.T) {
	mux := newServer()
	r := httptest.NewRequest(http.MethodGet, "/update/apply", nil)
	r.Header.Set("Origin", "https://abdallah-abolilah.github.io")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET على التحديث رجع %d", w.Code)
	}
}

// ⚠️ ومسارات التحديث ورا نفس الحارس زي الطباعة
func TestUpdateGuarded(t *testing.T) {
	mux := newServer()
	for _, path := range []string{"/update/check", "/update/apply"} {
		if w := post(t, mux, path, "https://evil.example", "{}"); w.Code != http.StatusForbidden {
			t.Fatalf("%s اتقبل من موقع تاني (%d)", path, w.Code)
		}
	}
}

// ============================================================
// اختيار الطابعتين المحفوظ
// ============================================================
// ⚠️ الطلب اللي بيحدد طابعة بالاسم لازم **يكسب** على المحفوظ: النظام
// بيبعت اسم الطابعة المتظبطة عنده، والمحفوظ للتجربة من الصفحة.
func TestPickPrinter(t *testing.T) {
	saveSettings(settings{RestockPrinter: "XP-80C", LabelPrinter: "XP-235B"})
	if got := pickPrinter("", "restock"); got != "XP-80C" {
		t.Fatalf("ورقة التزويد: %q", got)
	}
	if got := pickPrinter("", "label"); got != "XP-235B" {
		t.Fatalf("الملصق: %q", got)
	}
	if got := pickPrinter("طابعة-تانية", "restock"); got != "طابعة-تانية" {
		t.Fatalf("المطلوب المفروض يكسب: %q", got)
	}
	saveSettings(settings{})
	if got := pickPrinter("", "restock"); got != "" {
		t.Fatalf("بعد المسح: %q", got)
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	mux := newServer()
	ok := "https://abdallah-abolilah.github.io"
	w := post(t, mux, "/settings", ok, `{"restockPrinter":"A","labelPrinter":"B"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("الحفظ رجع %d: %s", w.Code, w.Body.String())
	}
	// ⚠️ ولازم ترجع في /status — وإلا الصفحة تفتح على اختيار غلط
	r := httptest.NewRequest(http.MethodGet, "/status", nil)
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, r)
	var s statusReply
	json.Unmarshal(w2.Body.Bytes(), &s)
	if s.RestockPrinter != "A" || s.LabelPrinter != "B" {
		t.Fatalf("الحالة مارجّعتش المحفوظ: %+v", s)
	}
	// GET على الحفظ مرفوض
	rg := httptest.NewRequest(http.MethodGet, "/settings", nil)
	rg.Header.Set("Origin", ok)
	wg := httptest.NewRecorder()
	mux.ServeHTTP(wg, rg)
	if wg.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET على الحفظ رجع %d", wg.Code)
	}
	saveSettings(settings{})
}

// ⚠️ التشغيل مع الويندوز POST مش GET — بيغيّر سجل الويندوز
func TestAutostartNeedsPost(t *testing.T) {
	mux := newServer()
	r := httptest.NewRequest(http.MethodGet, "/autostart", nil)
	r.Header.Set("Origin", "https://abdallah-abolilah.github.io")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET رجع %d", w.Code)
	}
	// وورا نفس الحارس
	if w2 := post(t, mux, "/autostart", "https://evil.example", "{}"); w2.Code != http.StatusForbidden {
		t.Fatalf("موقع تاني اتقبل: %d", w2.Code)
	}
}

// ⚠️ الصفحة لازم يكون فيها الحقلين والخيار — الفحص ده بيمسك لو حد
// شال واحد منهم وهو بيعدّل في الصفحة.
func TestPageHasControls(t *testing.T) {
	for _, want := range []string{
		`id="p"`, `id="l"`, `id="auto"`, `id="save"`, `id="up"`,
		"طابعة ورقة التزويد", "طابعة الملصق", "يشتغل لوحده مع الويندوز",
	} {
		if !strings.Contains(testPage, want) {
			t.Fatalf("الصفحة ناقصها: %s", want)
		}
	}
}

// ============================================================
// 🏷️ اختبارات الملصق (TSPL)
// ============================================================

// صورة PNG صغيرة للاختبار: عرضها بالنقط وارتفاعها، والبكسل (0,0) أسود
// والباقي أبيض.
func tinyLabelPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.White)
		}
	}
	img.Set(0, 0, color.Black)
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// ⚠️⚠️ أهم اختبار في الملف ده: القطبية.
// TSPL بِت ٠ = أسود. لو قلبنا غلط، اللاصقة بتطلع **سودا بالكامل**
// وكل لفة ورق في المحل بتضيع. الاختبار بيقرا البايت الأول من بيانات
// الصورة ويتأكد إن النقطة السودا بقت ٠ والباقي ١.
func TestTSPLPolarity(t *testing.T) {
	// 8 نقط عرض = بايت واحد في الصف. أول نقطة سودا.
	data, _, _, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, 8, 2), Copies: 1}}, 10, 5, 2, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	i := bytes.Index(data, []byte("BITMAP 0,0,1,2,0,"))
	if i < 0 {
		t.Fatalf("مالقيتش أمر BITMAP في:\n%q", data)
	}
	first := data[i+len("BITMAP 0,0,1,2,0,")]
	// النقطة السودا في أعلى بِت، والباقي أبيض → 0111 1111 = 0x7F
	if first != 0x7F {
		t.Fatalf("قطبية غلط: البايت الأول %#02x، المفروض 0x7f", first)
	}
}

// مفتاح الطوارئ بيرجّع القطبية زي ما هي من غير قلب.
func TestTSPLFlipPolarity(t *testing.T) {
	data, _, _, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, 8, 2), Copies: 1}}, 10, 5, 2, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	i := bytes.Index(data, []byte("BITMAP 0,0,1,2,0,"))
	if i < 0 {
		t.Fatal("مالقيتش أمر BITMAP")
	}
	if got := data[i+len("BITMAP 0,0,1,2,0,")]; got != 0x80 {
		t.Fatalf("المفتاح مابيلغيش القلب: %#02x، المفروض 0x80", got)
	}
}

// الترويسة بتتكتب مرة واحدة مهما كان عدد الملصقات — مش مرة لكل ملصق.
func TestTSPLHeaderOnce(t *testing.T) {
	items := []tsplLabel{
		{PNG: tinyLabelPNG(t, 8, 2), Copies: 3},
		{PNG: tinyLabelPNG(t, 8, 2), Copies: 5},
	}
	data, _, _, err := buildTSPLJob(items, 38, 25, 2, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	if n := bytes.Count(data, []byte("SIZE ")); n != 1 {
		t.Fatalf("SIZE اتكتب %d مرة، المفروض مرة واحدة", n)
	}
	if n := bytes.Count(data, []byte("GAP ")); n != 1 {
		t.Fatalf("GAP اتكتب %d مرة", n)
	}
	if n := bytes.Count(data, []byte("\r\nCLS\r\n")); n != 2 {
		t.Fatalf("CLS اتكتب %d مرة، المفروض واحدة لكل ملصق", n)
	}
}

// ⭐ العدد بيروح للطابعة كـPRINT n,1 — مش بتكرار الصورة. ده اللي
// بيخلي 40 ملصق حجمهم زي ملصق واحد.
func TestTSPLCopiesNotRepeated(t *testing.T) {
	one, _, _, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, 304, 200), Copies: 1}}, 38, 25, 2, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	forty, _, _, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, 304, 200), Copies: 40}}, 38, 25, 2, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(forty, []byte("PRINT 40,1")) {
		t.Fatal("العدد مابيتبعتش كـPRINT 40,1")
	}
	// الفرق المسموح: رقم أطول بحرف واحد وبس
	if d := len(forty) - len(one); d > 4 {
		t.Fatalf("الصورة اتكررت: الفرق %d بايت", d)
	}
}

// المقاس بيتحسب من نقط الصورة لو النظام مابعتش مقاس.
func TestTSPLSizeFromDots(t *testing.T) {
	data, w, h, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, 304, 200), Copies: 1}}, 0, 0, 2, 1, false)
	if err != nil {
		t.Fatal(err)
	}
	if w != 304 || h != 200 {
		t.Fatalf("مقاس النقط غلط: %dx%d", w, h)
	}
	// 304/203*25.4 = 38.03  و 200/203*25.4 = 25.02
	if !bytes.HasPrefix(data, []byte("SIZE 38.0")) {
		t.Fatalf("المقاس المحسوب غلط:\n%.40q", data)
	}
}

// الافتراضيات هي نفس اللي في عيّنة الخطوط اللي اتجرّبت على ماكينة المحل.
func TestTSPLDefaults(t *testing.T) {
	data, _, _, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, 8, 2), Copies: 1}}, 38, 25, -1, 9, false)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"SIZE 38 mm,25 mm", "GAP 2 mm,0 mm", "DIRECTION 1", "REFERENCE 0,0"} {
		if !bytes.Contains(data, []byte(want)) {
			t.Fatalf("ناقص %q في:\n%.120q", want, data)
		}
	}
}

// قايمة فاضية = خطأ واضح، مش أمر فاضي بيتبعت للطابعة.
func TestTSPLEmptyRejected(t *testing.T) {
	if _, _, _, err := buildTSPLJob(nil, 38, 25, 2, 1, false); err == nil {
		t.Fatal("القايمة الفاضية عدّت")
	}
}

// صورة بمقاس غير معقول بتترفض بدل ما تغرق الطابعة.
func TestTSPLHugeRejected(t *testing.T) {
	if _, _, _, err := buildTSPLJob([]tsplLabel{{PNG: tinyLabelPNG(t, maxLabelDots+8, 4), Copies: 1}}, 38, 25, 2, 1, false); err == nil {
		t.Fatal("الصورة العملاقة عدّت")
	}
}

// ⚠️ الإعدادات القديمة (من غير حقول الملصق) لازم ترجّع الافتراضيات،
// مش أصفار. ده كان هيبعت GAP 0 لورق فيه فواصل.
func TestLabelOptionsDefaults(t *testing.T) {
	setMu.Lock()
	setData = settings{RestockPrinter: "A", LabelPrinter: "B"}
	setMu.Unlock()
	gap, dir, flip := labelOptions()
	if gap != 2 || dir != 1 || flip {
		t.Fatalf("الافتراضيات غلط: gap=%v dir=%v flip=%v", gap, dir, flip)
	}
}

// وصفر **مكتوب صراحةً** لازم يعدّي — ورق مستمر من غير فواصل.
func TestLabelOptionsExplicitZero(t *testing.T) {
	z, d := 0.0, 0
	setMu.Lock()
	setData = settings{LabelGapMm: &z, LabelDirection: &d}
	setMu.Unlock()
	gap, dir, _ := labelOptions()
	if gap != 0 || dir != 0 {
		t.Fatalf("الصفر الصريح اتبلع: gap=%v dir=%v", gap, dir)
	}
	setMu.Lock()
	setData = settings{}
	setMu.Unlock()
}
