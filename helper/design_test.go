package main

// ============================================================
// 🎨 فحوصات تصميم الملصق
// ============================================================
// ⚠️⚠️ الفحص الأهم هنا مش "بيحفظ ولا لأ" — ده **بيرفض إيه**. تصميم
// بايظ متخزّن معناه إن كل طبعة بعد كده بتطلع غلط، والمستخدم بيدوّر في
// المكان الغلط (بيفتكر الطابعة بايظة).

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ============================================================
// ⭐⭐⭐⭐⭐ الافتراضي لازم يعدّي فحصه هو
// ============================================================
// لو الافتراضي نفسه مرفوض، أول واحد يفتح المصمّم هيلاقي رسالة خطأ
// على حاجة **إحنا** حطّيناها — وده أسوأ انطباع أول ممكن.
func TestDefaultDesignIsValid(t *testing.T) {
	d := defaultDesign()
	if err := validateDesign(&d); err != nil {
		t.Fatalf("التصميم الافتراضي مرفوض: %v", err)
	}
}

// ⚠️ والافتراضي لازم يطابق الملصق اللي بيطبع فعلًا: 38×25 بملصقين.
// لو الرقم ده اتغيّر بالغلط، اللي يفتح المصمّم هيلاقي مقاس غريب.
func TestDefaultMatchesShopLabel(t *testing.T) {
	d := defaultDesign()
	if d.WidthMm != 38 || d.HeightMm != 25 || d.Halves != 2 {
		t.Fatalf("مقاس غير متوقّع: %v×%v بـ%v", d.WidthMm, d.HeightMm, d.Halves)
	}
	if got := d.cellHeightMm(); got != 12.5 {
		t.Fatalf("ارتفاع الملصق الواحد %v — المفروض 12.5", got)
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ حد الأمان — القاعدة اللي اتطلبت بالنص
// ============================================================
// "خلي بالك من الفراغ اللي من جهة اليسار عشان الملصق ميبقاش علي الحافة
//
//	او ممكن ب اختلاف المكن او تحريف الملصق يختفي فيه حاجه"
//
// ⚠️ ودي مرفوضة عند الحفظ مش تحذير: التحذير بيتقفل ويتنسي.
func TestRejectsElementOnTheEdge(t *testing.T) {
	cases := []struct {
		name string
		mod  func(*labelDesign)
	}{
		{"لازق في الجنب الشمال", func(d *labelDesign) { d.Elements[1].X = 0.2 }},
		{"لازق في فوق", func(d *labelDesign) { d.Elements[1].Y = 0.1 }},
		{"خارج من الجنب اليمين", func(d *labelDesign) { d.Elements[1].W = 40 }},
		// ⚠️⚠️ ودي أخطرهم: خط القص في نص الورقة. الماكينة بتحسّ الفراغ
		// بين اللاصقات بحسّاس وفيه فرق بين ماكينة وماكينة.
		{"خارج من تحت (خط القص)", func(d *labelDesign) { d.Elements[1].H = 12 }},
	}
	for _, c := range cases {
		d := defaultDesign()
		c.mod(&d)
		if err := validateDesign(&d); err == nil {
			t.Fatalf("%s: المفروض يترفض وعدّى", c.name)
		}
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ الخط أكبر من الصندوق
// ============================================================
// أشهر غلطة في أي مصمّم: بتكبّر الخط والصندوق زي ما هو، فالكلام بيتقص
// والمستخدم بيفتكر إن الطابعة بايظة. لازم يترفض **وهو بيحفظ**.
// ⚠️⚠️ الفحص ده اتقلب رأسًا على عقب في v0.97.1، واتقلب **صح**.
//
// كان بيقول: خط أكبر من الصندوق = مرفوض. واتبلّغ بالنص:
//   "جربت اخلي الاسم ينزل في ٣ سطور نزل عادي بس لما جيت احفظ التصميم
//    قالي ان الحجم لازم يكبر بالرغم من في المعاينة قدامي علي الشاشة
//    طلعت عادي مظبوطه وانا كنت راضي"
//
// وكان معاه حق: الملصق الحقيقي **بيصغّر** (overflow: shrink)، فالتصميم
// ده بيتطبع كويس. الرفض كان بيمنع حاجة شغّالة، والمعاينة كانت بتقول
// الحقيقة والحفظ بيكذّبها.
func TestAcceptsWhatTheRealLabelCanShrink(t *testing.T) {
	d := defaultDesign()
	e := &d.Elements[1]
	e.FontMm = 1.9
	e.Lines = 3
	e.H = 6.0 // 3 × 1.9 × 1.2 = 6.84 > 6.0 — بس هيتصغّر لـ1.67مم ويتقرا
	if err := validateDesign(&d); err != nil {
		t.Fatalf("تصميم بيتصغّر عادي اترفض: %v", err)
	}
}

// ⚠️⚠️ والرفض الوحيد اللي فضل: المساحة أصغر من إن **أي** كلام يتقرا
// فيها. التصغير مش سحر — تحت 1.2مم الحروف بتتلخبط على 203 نقطة/بوصة.
func TestRejectsWhenEvenShrunkIsUnreadable(t *testing.T) {
	d := defaultDesign()
	e := &d.Elements[1]
	e.Lines = 3
	e.H = 3.5 // 3.5 ÷ (3 × 1.2) = 0.97مم — مايتقراش
	err := validateDesign(&d)
	if err == nil {
		t.Fatal("مساحة مايتقراش فيها كلام وعدّت")
	}
	// ⚠️ والرسالة لازم تقول الرقم اللي طلع والرقم اللي لازم يوصله.
	for _, want := range []string{"0.97", "1.2", "قلّل السطور"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("الرسالة ناقصة %q: %v", want, err)
		}
	}
}

// ⚠️ واللي **مابيصغّرش** (بيتقص بنقط) لازم يدخل بالمقاس المطلوب —
// غير كده بيضيع كلام فعلًا، وده مختلف تمامًا عن إنه يصغّر.
func TestRejectsEllipsisThatWouldCutText(t *testing.T) {
	d := defaultDesign()
	e := &d.Elements[1]
	e.FontMm = 3.5
	e.Lines = 2 // 8.4مم في صندوق 4.6
	e.Overflow = overflowEllipsis
	err := validateDesign(&d)
	if err == nil {
		t.Fatal("كلام هيتقص وعدّى")
	}
	if !strings.Contains(err.Error(), "صغّره") {
		t.Fatalf("الرسالة مش بتقول الحل الأسهل: %v", err)
	}
	// ⚠️ ونفس التصميم بالظبط بـ«صغّره» لازم **يعدّي** — ده الفرق كله.
	e.Overflow = overflowShrink
	if err := validateDesign(&d); err != nil {
		t.Fatalf("نفس التصميم بـ«صغّره» اترفض: %v", err)
	}
}

// ⚠️ والحالة المظبوطة بالعافية لازم **تعدّي**: لو الفحص متشدّد أكتر من
// اللازم، المستخدم مش هيعرف يستغل المساحة اللي عنده.
func TestAcceptsExactFit(t *testing.T) {
	d := defaultDesign()
	d.Elements[1].FontMm = 2.0
	d.Elements[1].Lines = 2
	d.Elements[1].H = 4.8 // 2 × 2.0 × 1.2 = 4.8 بالظبط
	if err := validateDesign(&d); err != nil {
		t.Fatalf("مقاس مظبوط بالعافية اترفض: %v", err)
	}
}

// ============================================================
// ⭐⭐⭐⭐ اسم الصنف لازم يفضل موجود
// ============================================================
// ملصق من غير اسم مالوش معنى، والمستخدم ممكن يشيله بالغلط وهو بيجرّب.
func TestRejectsMissingName(t *testing.T) {
	d := defaultDesign()
	out := d.Elements[:0]
	for _, e := range d.Elements {
		if e.Kind != elName {
			out = append(out, e)
		}
	}
	d.Elements = out
	if err := validateDesign(&d); err == nil {
		t.Fatal("تصميم من غير اسم صنف عدّى")
	}
}

// ⚠️ والعنصر المكرر: واحد هيترسم فوق التاني والحبر يطلع متلخبط.
func TestRejectsDuplicateElement(t *testing.T) {
	d := defaultDesign()
	d.Elements = append(d.Elements, d.Elements[1])
	if err := validateDesign(&d); err == nil {
		t.Fatal("عنصر مكرر عدّى")
	}
}

func TestRejectsUnknownKind(t *testing.T) {
	d := defaultDesign()
	d.Elements[1].Kind = "شعار"
	if err := validateDesign(&d); err == nil {
		t.Fatal("نوع عنصر مش معروف عدّى")
	}
}

// ============================================================
// ⭐⭐⭐⭐ القيم الناقصة بتتملّى لوحدها
// ============================================================
// التصميم الجاي من نسخة أقدم أو من ملف اتعدّل بالإيد ممكن يبقى ناقص
// حقول — ومايصحّش يترفض عشان كده.
func TestFillsDefaults(t *testing.T) {
	d := defaultDesign()
	d.Elements[1].Align = ""
	d.Elements[1].Weight = ""
	d.Elements[1].Overflow = ""
	d.Elements[1].Show = ""
	d.Elements[1].Lines = 0
	if err := validateDesign(&d); err != nil {
		t.Fatalf("اترفض بدل ما يتملّى: %v", err)
	}
	e := d.Elements[1]
	if e.Align != "center" || e.Weight != "normal" || e.Overflow != "shrink" || e.Show != "always" || e.Lines != 1 {
		t.Fatalf("القيم مااتملّتش صح: %+v", e)
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ المسار اللي النظام بيقرا منه
// ============================================================
// ⚠️ ده العقد بين البرنامج والنظام: لو الشكل ده اتغيّر، الملصق بيقع
// عند العميل من غير ما أي فحص تاني يبان.
func TestGetDesignReturnsUsableJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	handleDesign(rec, httptest.NewRequest(http.MethodGet, "/design", nil))

	var d labelDesign
	if err := json.Unmarshal(rec.Body.Bytes(), &d); err != nil {
		t.Fatalf("الرد مش JSON مفهوم: %v", err)
	}
	if d.WidthMm <= 0 || len(d.Elements) == 0 {
		t.Fatalf("رد فاضي أو ناقص: %+v", d)
	}
	// ⚠️ والاسم لازم يبقى فيه — النظام بيدوّر عليه بالاسم ده بالحرف.
	found := false
	for _, e := range d.Elements {
		if e.Kind == elName {
			found = true
		}
	}
	if !found {
		t.Fatal("الرد مافيهوش عنصر اسم الصنف")
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ الحفظ الغلط بيرجّع السبب — والكود لسه 200
// ============================================================
// ⚠️ الكود 400 كان بيخلّي المتصفح يرمي قبل ما نوصل للرسالة العربية،
// فالمستخدم كان بيشوف "خطأ" وخلاص.
func TestPostBadDesignExplainsWhy(t *testing.T) {
	d := defaultDesign()
	// ⚠️ لازم تصميم **مرفوض فعلًا** بعد ما القاعدة اتصلحت: الخط
	// الكبير لوحده بقى مقبول (بيتصغّر)، فبنضيّق المساحة لدرجة إن
	// اللي هيطلع مايتقراش.
	d.Elements[1].Lines = 4
	d.Elements[1].H = 3.0 // 3.0 ÷ (4 × 1.2) = 0.63مم
	body, _ := json.Marshal(d)

	rec := httptest.NewRecorder()
	handleDesign(rec, httptest.NewRequest(http.MethodPost, "/design", strings.NewReader(string(body))))

	if rec.Code != http.StatusOK {
		t.Fatalf("الكود %d — المفروض 200 عشان الرسالة توصل", rec.Code)
	}
	var out struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	if out.OK {
		t.Fatal("تصميم بايظ اتقبل")
	}
	if out.Error == "" {
		t.Fatal("اترفض من غير سبب")
	}
}

// ⚠️ وجسم مش JSON مايوقّعش البرنامج.
func TestPostGarbageDoesNotCrash(t *testing.T) {
	rec := httptest.NewRecorder()
	handleDesign(rec, httptest.NewRequest(http.MethodPost, "/design", strings.NewReader("مش JSON خالص {{{")))
	if rec.Code != http.StatusOK {
		t.Fatalf("الكود %d", rec.Code)
	}
	var out struct {
		OK bool `json:"ok"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	if out.OK {
		t.Fatal("كلام فاضي اتقبل كتصميم")
	}
}

// ============================================================
// ⭐⭐⭐⭐ صفحة المصمّم بتتقدّم فعلًا
// ============================================================
func TestDesignerPageHasTheEssentials(t *testing.T) {
	for _, want := range []string{
		"مصمّم الملصق", // العنوان
		"id=\"sheet\"", // لوحة المعاينة
		"/design/all",  // بتقرا التصاميم
		"احفظ التصميم",
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("الصفحة مافيهاش: %s", want)
		}
	}
	// ⚠️⚠️ المعاينة **لازم** ترسم بنفس خط الملصق الحقيقي، وإلا اللي
	// تشوفه على الشاشة مش اللي هيطلع على الورق — وده بيخلّي المصمّم
	// كله بلا فايدة.
	if !strings.Contains(designerPage, "Arial, Helvetica, Tahoma") {
		t.Fatal("المعاينة مش بترسم بخط الملصق")
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ الحالة اللي اتبلّغت بالنص — لازم **تتحفظ**
// ============================================================
// "٣ سطور، خط ١.٩مم، صندوق ٦مم" — ده اللي كان قدامه على الشاشة وهو
// راضي عنه، والحفظ كان بيرفضه. الفحص ده بيثبّت إنه بقى بيتحفظ،
// وبيثبّت كمان إن الحد اللي فضل (اللي مايتقراش) لسه شغّال.
func TestReportedThreeLineCaseSaves(t *testing.T) {
	d := defaultDesign()
	e := &d.Elements[1]
	e.FontMm = 1.9
	e.Lines = 3
	e.H = 6.0

	body, _ := json.Marshal(d)
	rec := httptest.NewRecorder()
	handleDesign(rec, httptest.NewRequest(http.MethodPost, "/design", strings.NewReader(string(body))))

	var out struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	if !out.OK {
		t.Fatalf("الحالة اللي اتبلّغت لسه بتترفض: %s", out.Error)
	}
}

// ============================================================
// ⭐⭐⭐⭐ لوحة بيانات التجربة
// ============================================================
// اتطلبت بالنص: "عاوزك تحت اسم الصنف ورقم الباركود والسعر والسعر قبل
// الخصم حقول اكتب فيها عشان اختبر فيها اللي عاوزه".
func TestDesignerHasSampleDataFields(t *testing.T) {
	for _, want := range []string{
		"s-name", "s-code", "s-price", "s-old", // الأربع خانات
		"بيانات التجربة",
		"اسم طويل", "اسم قصير", // الحالتين اللي بيفرّقوا
		"s-print", "اطبع تجربة",
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("المصمّم مافيهوش: %s", want)
		}
	}
}

// ⚠️⚠️ والـQR لازم يبقى **حقيقي** من الرقم اللي في الخانة، مش مربع
// توضيحي: عدد مربعاته بيزيد كل ما الرقم يطول، فرمز مقاسه مظبوط لرقم
// من ٧ أرقام ممكن يبقى مزنوق لرقم من ١٣ — واللي بيصمّم لازم يشوف ده.
func TestDesignerDrawsRealQR(t *testing.T) {
	if !strings.Contains(designerPage, `<script src="/qrcode.js">`) {
		t.Fatal("المصمّم مش بيحمّل مولّد الـQR")
	}
	if !strings.Contains(designerPage, "qrURL(") {
		t.Fatal("مافيش دالة بتولّد الرمز")
	}
	if qrcodeLibJS == "" {
		t.Fatal("ملف المولّد فاضي")
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ نسخة مولّد الـQR لازم تفضل **مطابقة** للي النظام بيستعمله
// ============================================================
// ⚠️⚠️ الملف مكرّر عشان go:embed مابيقدرش يطلع بره مجلد الموديول.
// والتكرار معناه إنهم ممكن يفرقوا من غير ما حد ياخد باله — وساعتها
// المعاينة هتوري رمز بعدد مربعات غير اللي بيتطبع فعلًا، فتظبط المقاس
// على حاجة وتطلع حاجة تانية. الفحص ده هو اللي بيمنع ده.
func TestQRLibMatchesSystem(t *testing.T) {
	mine, err := os.ReadFile("qrcode-generator.js")
	if err != nil {
		t.Fatalf("مش لاقي النسخة بتاعة البرنامج: %v", err)
	}
	theirs, err := os.ReadFile(filepath.Join("..", "js", "vendor", "qrcode-generator.js"))
	if err != nil {
		t.Fatalf("مش لاقي نسخة النظام: %v", err)
	}
	if !bytes.Equal(mine, theirs) {
		t.Fatal("نسخة المولّد في البرنامج مش مطابقة للي في النظام — انسخها تاني")
	}
	if string(mine) != qrcodeLibJS {
		t.Fatal("اللي متحفور في البرنامج مش هو اللي في الملف")
	}
}
