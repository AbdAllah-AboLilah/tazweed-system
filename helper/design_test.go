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
	"fmt"
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

// ============================================================
// ⭐⭐⭐⭐⭐ مقسوم ٤ = عمودين، مش حالة خاصة
// ============================================================
// اتطلب بالنص: "بالنسبة مقسوم ٤ ايه اللي ممكن نعمله فيه وهل هيبقي
// ليه حاجه ل تصميمه هو".
func TestQuarterIsJustTwoColumns(t *testing.T) {
	d := defaultQuarterDesign()
	if err := validateDesign(&d); err != nil {
		t.Fatalf("مقسوم ٤ الافتراضي مرفوض: %v", err)
	}
	if d.Cols != 2 || d.Halves != 2 {
		t.Fatalf("شكل غير متوقّع: %d صف × %d عمود", d.Halves, d.Cols)
	}
	if got := d.cellWidthMm(); got != 19 {
		t.Fatalf("عرض اللاصقة %v — المفروض 19", got)
	}
	if got := d.cellHeightMm(); got != 12.5 {
		t.Fatalf("طول اللاصقة %v — المفروض 12.5", got)
	}
}

// ⚠️ والتصميم القديم (من قبل الأعمدة) لازم يفضل صالح وبعمود واحد.
func TestDesignWithoutColsIsOneColumn(t *testing.T) {
	d := defaultDesign()
	d.Cols = 0
	if err := validateDesign(&d); err != nil {
		t.Fatalf("تصميم من غير أعمدة اترفض: %v", err)
	}
	if got := d.cellWidthMm(); got != 38 {
		t.Fatalf("عرض اللاصقة %v — المفروض 38", got)
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ خط القص الرأسي — نفس خطورة الأفقي
// ============================================================
// ⚠️⚠️ العنصر اللي بيعدّي نص الورقة في مقسوم ٤ بيتقص نصين. والحد
// لازم يبقى على **عرض اللاصقة** مش عرض الورقة، وإلا الفحص بيعدّي
// على تصميم بيطلّع نص اسم على كل لاصقة.
func TestRejectsElementCrossingTheVerticalCut(t *testing.T) {
	d := defaultQuarterDesign()
	d.Elements[1].W = 25 // 7.6 + 25 = 32.6 — عدّى اللاصقة (19مم) بكتير
	if err := validateDesign(&d); err == nil {
		t.Fatal("عنصر بيعدّي خط القص الرأسي وعدّى")
	}
	// ⚠️ ونفس العرض ده **مقبول** في تصميم بعمود واحد — الفرق في
	// الشكل مش في الرقم.
	one := defaultDesign()
	one.Elements[1].X = 2.0
	one.Elements[1].W = 25
	if err := validateDesign(&one); err != nil {
		t.Fatalf("نفس العرض اترفض في تصميم بعمود واحد: %v", err)
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ الأدوار — البرنامج عمره ما يرجّع "مافيش تصميم"
// ============================================================
func TestDesignForRoleAlwaysAnswers(t *testing.T) {
	for _, role := range []string{roleNormal, roleQuarter, roleNoPrice} {
		d := designForRole(role)
		if d.Name == "" || len(d.Elements) == 0 || d.WidthMm <= 0 {
			t.Fatalf("%s: رجع تصميم فاضي %+v", role, d)
		}
	}
	// ⚠️ ومقسوم ٤ لازم يرجع **بعمودين** من غير ما حد يختار حاجة —
	// وإلا أول طبعة مقسوم ٤ هتطلع ملصق عادي والمستخدم مش هيفهم.
	if q := designForRole(roleQuarter); q.Cols < 2 {
		t.Fatalf("دور مقسوم ٤ رجع بعمود واحد: %+v", q)
	}
}

// ⚠️⚠️ و"من غير سعر" بيرجع **لنفس تصميم العادي** لما مافيش تصميم
// مخصوص. ده اللي بيخلّي الإجابة على السؤال اللي اتسأل بالنص = "آه،
// هيتنفّذ نفس التصميم والسعر بيختفي" من غير ما المستخدم يعمل حاجة.
func TestNoPriceFallsBackToNormal(t *testing.T) {
	a := designForRole(roleNoPrice)
	b := designForRole(roleNormal)
	if a.Name != b.Name {
		t.Fatalf("من غير سعر رجع %q والعادي %q", a.Name, b.Name)
	}
}

// ⚠️ ونوع مش معروف (نظام أجدد من البرنامج) بيرجّع العادي مش خطأ:
// الملصق لازم يطلع.
func TestUnknownRoleFallsBack(t *testing.T) {
	rec := httptest.NewRecorder()
	handleDesignFor(rec, httptest.NewRequest(http.MethodGet, "/design/for?role=حاجة-جديدة", nil))
	var out struct {
		Role      string      `json:"role"`
		HidePrice bool        `json:"hidePrice"`
		Design    labelDesign `json:"design"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("رد مش مفهوم: %v", err)
	}
	if out.Role != roleNormal || len(out.Design.Elements) == 0 {
		t.Fatalf("مارجعش للعادي: %+v", out)
	}
	if out.HidePrice {
		t.Fatal("خبّى السعر في دور عادي")
	}
}

// ⚠️⚠️ والعقد مع النظام: الدور ده بيقول "خبّي السعر" ولا لأ. لو
// السطر ده اتكسر، الطبعة من غير سعر هتطلع بالسعر — والمستخدم قافله
// عن قصد.
func TestNoPriceRoleSaysHidePrice(t *testing.T) {
	rec := httptest.NewRecorder()
	handleDesignFor(rec, httptest.NewRequest(http.MethodGet, "/design/for?role=noPrice", nil))
	var out struct {
		HidePrice bool `json:"hidePrice"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)
	if !out.HidePrice {
		t.Fatal("دور «من غير سعر» مابيقولش يخبّي السعر")
	}
}

// ⚠️ واختيار تصميم مش موجود بيترفض — بدل ما يتخزّن اسم بايظ ويرجع
// كل طبعة للافتراضي في سكوت.
func TestSetRoleRejectsUnknownDesign(t *testing.T) {
	if err := setDesignRole(roleQuarter, "تصميم مخترع"); err == nil {
		t.Fatal("اسم تصميم مش موجود اتقبل")
	}
	if err := setDesignRole("نوع مخترع", ""); err == nil {
		t.Fatal("نوع ملصق مش معروف اتقبل")
	}
}

// ⭐⭐ والقايمة لازم تورّي الافتراضيين **دايمًا**، وإلا اللي بيفتح
// أول مرة بيلاقي حقل "مقسوم ٤" فاضي ومفيش حاجة يختارها.
func TestDesignListAlwaysOffersBothDefaults(t *testing.T) {
	rec := httptest.NewRecorder()
	handleDesignAll(rec, httptest.NewRequest(http.MethodGet, "/design/all", nil))
	var out struct {
		Designs []labelDesign     `json:"designs"`
		Roles   map[string]string `json:"roles"`
	}
	json.Unmarshal(rec.Body.Bytes(), &out)

	names := map[string]bool{}
	for _, d := range out.Designs {
		names[d.Name] = true
	}
	for _, want := range []string{defaultDesign().Name, defaultQuarterDesign().Name} {
		if !names[want] {
			t.Fatalf("القايمة مافيهاش %q: %v", want, names)
		}
	}
	for _, role := range []string{roleNormal, roleQuarter, roleNoPrice} {
		if out.Roles[role] == "" {
			t.Fatalf("الدور %s مالوش تصميم فعلي", role)
		}
	}
}

// ============================================================
// ⭐⭐⭐⭐⭐ السعر والسعر القديم — كل واحد في صندوقه
// ============================================================
// اتطلب بالنص:
//
//	"السعر القديم اللي هو السعر قبل الخصم كان في الاول بيتحرك لوحده
//	 دلوقتي مش بيتحرك من مكانه بقي مربوط بالسعر لازم عشان احركه احرك
//	 السعر والاتنين يتحركوا مع بعض والمفروض السعر اللي هو بعد الخصم
//	 يبقي علي اليمين وقبل الخصم علي اليسار والاتنين يتحركوا لوحدهم"
//
// ⚠️⚠️ والخطر مش "بيتحرك ولا لأ" — الخطر إن التصاميم المحفوظة من قبل
// صندوقيها **فوق بعض**، ولو رسمناهم كده الرقمين بيتراكبوا على الورق.
func priceBoxes(d labelDesign) (p, o designElement, ok bool) {
	var gotP, gotO bool
	for _, e := range d.Elements {
		switch e.Kind {
		case elPrice:
			p, gotP = e, true
		case elOldPrice:
			o, gotO = e, true
		}
	}
	return p, o, gotP && gotO
}

func TestDefaultPriceBoxesDoNotOverlap(t *testing.T) {
	p, o, ok := priceBoxes(defaultDesign())
	if !ok {
		t.Fatal("الافتراضي مافيهوش السعرين")
	}
	if o.X+o.W > p.X {
		t.Fatalf("الصندوقين متراكبين: القديم %v→%v والسعر %v→%v",
			o.X, o.X+o.W, p.X, p.X+p.W)
	}
	// ⚠️ السعر بعد الخصم على **اليمين** (X أكبر) والقديم على الشمال —
	// ده اللي اتطلب بالحرف.
	if p.X <= o.X {
		t.Fatalf("السعر المفروض على اليمين: السعر X=%v والقديم X=%v", p.X, o.X)
	}
	// ولسه جوّه الملصق
	if p.X+p.W > 36.0 {
		t.Fatalf("صندوق السعر خارج المساحة الآمنة: بينتهي عند %v", p.X+p.W)
	}
}

// ⚠️⚠️ ده الترحيل: تصميم محفوظ بالشكل القديم (نفس X للاتنين) لازم
// يخرج مفصول — وإلا الرقمين هيتراكبوا: "110L.E85 L.E".
func TestSplitPricesSeparatesOldSavedDesign(t *testing.T) {
	d := labelDesign{
		Name: "قديم", WidthMm: 38, HeightMm: 25, Halves: 2,
		Elements: []designElement{
			{Kind: elName, X: 12.5, Y: 1.2, W: 23.5, H: 4.6, FontMm: 1.9, Lines: 2},
			{Kind: elPrice, X: 12.5, Y: 8.8, W: 23.5, H: 2.9, FontMm: 2.4, Lines: 1},
			{Kind: elOldPrice, X: 12.5, Y: 8.8, W: 9.0, H: 2.9, FontMm: 2.0, Lines: 1},
		},
	}
	got := splitPrices(d)
	p, o, _ := priceBoxes(got)

	if o.X+o.W > p.X {
		t.Fatalf("لسه متراكبين: القديم %v→%v والسعر %v→%v", o.X, o.X+o.W, p.X, p.X+p.W)
	}
	if p.X <= o.X {
		t.Fatalf("السعر المفروض على اليمين: %v مقابل %v", p.X, o.X)
	}
	// ⚠️ ومايخرجش عن المساحة اللي كانت للسعر: الفصل مش المفروض ياكل
	// من الاسم ولا يطلع بره الملصق.
	if o.X < 12.5 || p.X+p.W > 36.0+0.001 {
		t.Fatalf("خرج عن المساحة: القديم من %v والسعر لحد %v", o.X, p.X+p.W)
	}
	// والتصميم الأصلي مااتلمسش (نسخة مش إشارة)
	if d.Elements[1].X != 12.5 || d.Elements[1].W != 23.5 {
		t.Fatalf("splitPrices عدّلت في الأصل: %v", d.Elements[1])
	}
}

// ⚠️⚠️ الأهم: مفيش شغل بعد المرة الأولى. لو الدالة بتحرّك كل مرة،
// الصندوق بيزحف مع كل قراية والتصميم بيضيع تحت إيد المستخدم.
func TestSplitPricesIsIdempotent(t *testing.T) {
	d := splitPrices(defaultDesign())
	again := splitPrices(d)
	p1, o1, _ := priceBoxes(d)
	p2, o2, _ := priceBoxes(again)
	if p1 != p2 || o1 != o2 {
		t.Fatalf("اتغيّرت في المرة التانية:\n قبل: %v | %v\n بعد: %v | %v", p1, o1, p2, o2)
	}
}

// اللي فصلهم بإيده مايتلمسش
func TestSplitPricesLeavesSeparatedBoxesAlone(t *testing.T) {
	d := labelDesign{Elements: []designElement{
		{Kind: elPrice, X: 24.0, Y: 8.8, W: 12.0, H: 2.9},
		{Kind: elOldPrice, X: 12.5, Y: 8.8, W: 9.0, H: 2.9},
	}}
	got := splitPrices(d)
	p, o, _ := priceBoxes(got)
	if p.X != 24.0 || p.W != 12.0 || o.X != 12.5 || o.W != 9.0 {
		t.Fatalf("لمست تصميم مفصول أصلًا: %v | %v", p, o)
	}
}

// ⚠️ ومقسوم ٤ مافيهوش سعر قديم خالص — الدالة لازم تعدّي من غير ما تقع
func TestSplitPricesHandlesMissingOldPrice(t *testing.T) {
	d := defaultQuarterDesign()
	got := splitPrices(d)
	if len(got.Elements) != len(d.Elements) {
		t.Fatalf("عدد العناصر اتغيّر: %d → %d", len(d.Elements), len(got.Elements))
	}
}

// ⚠️ مساحة مش كفاية = سيبها زي ما هي. الزوج المتراكب أهون من صندوق
// بعرض سالب (اللي معناه ملصق فاضي).
func TestSplitPricesRefusesWhenTooNarrow(t *testing.T) {
	d := labelDesign{Elements: []designElement{
		{Kind: elPrice, X: 10, Y: 8, W: 1.2, H: 2.9},
		{Kind: elOldPrice, X: 10, Y: 8, W: 1.2, H: 2.9},
	}}
	got := splitPrices(d)
	p, o, _ := priceBoxes(got)
	if p.X != 10 || o.X != 10 {
		t.Fatalf("فصلت في مساحة مش كفاية: %v | %v", p, o)
	}
}

// ============================================================
// ▾ خانات التجربة بتتطوي
// ============================================================
// اتطلب بالنص: "عاوزك تخلي في شاشة التصميم خانة بيانات التجربة تبقي
// بتفتح وتقفل يعني ممكن اضغط علي سهم يخفي الخانه كلهم".
func TestSampleFieldsCollapse(t *testing.T) {
	for _, want := range []string{
		`id="s-toggle"`, `id="s-body"`, `id="s-chev"`,
		`aria-expanded`, `aria-controls="s-body"`,
		"tz_sample_open", // بتتفكر
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("الطيّة ناقصة: %s", want)
		}
	}
	// ⚠️⚠️ وزرار «اطبع تجربة» **بره** الطيّة: لو اتطوى معاهم، كل
	// تجربة هتحتاج فتحة زيادة.
	body := designerPage[strings.Index(designerPage, `id="s-body"`):]
	end := strings.Index(body, `id="s-print"`)
	closeTag := strings.Index(body, `</div>
   <div class="row"`)
	if end < 0 || closeTag < 0 || closeTag > end {
		t.Fatal("زرار «اطبع تجربة» جوّه الطيّة — المفروض بره")
	}
}

// ⚠️ والمعاينة مابقتش بترسم الزوج: لو فضل الكود القديم موجود، الشاشة
// هتوري زوج متوسّط والورق هيطلع صندوقين.
func TestDesignerDroppedThePricePair(t *testing.T) {
	for _, gone := range []string{"drawPricePair", "showOldPrice"} {
		if strings.Contains(designerPage, gone) {
			t.Fatalf("لسه فيه %s — المعاينة هتخالف الورق", gone)
		}
	}
}

// ============================================================
// ✏️ تغيير اسم تصميم
// ============================================================
// اتطلب بالنص: "وكان يبقي متاح اعدل اسم التصميم".
//
// ⚠️⚠️ والخطر مش "بيتغيّر ولا لأ" — الخطر إن اللي بيشاور على الاسم
// القديم (التصميم المستخدم، والأدوار) يفضل مكانه، فالملصق يتغيّر
// شكله في سكوت.
func TestRenameKeepsOneDesignNotTwo(t *testing.T) {
	withTempSettings(t)
	d := defaultDesign()
	d.Name = "ملصق الفرع"
	if err := saveDesign(d); err != nil {
		t.Fatalf("الحفظ فشل: %v", err)
	}
	if err := renameDesign("ملصق الفرع", "ملصق المخزن"); err != nil {
		t.Fatalf("تغيير الاسم فشل: %v", err)
	}
	s := getSettings()
	if len(s.Designs) != 1 {
		names := []string{}
		for _, x := range s.Designs {
			names = append(names, x.Name)
		}
		t.Fatalf("المفروض تصميم واحد، لقيت %d: %v", len(s.Designs), names)
	}
	if s.Designs[0].Name != "ملصق المخزن" {
		t.Fatalf("الاسم مااتغيّرش: %s", s.Designs[0].Name)
	}
}

// ⚠️⚠️ أهم فحص في الملف ده: الدور بيشاور على **اسم**. لو سبناه على
// القديم، الدور بيلاقي اسم مش موجود ويرجع للافتراضي من غير ما حد
// يعرف — يعني تغيّر الاسم فتلاقي الملصق اتغيّر.
func TestRenameFollowsRolesAndActive(t *testing.T) {
	withTempSettings(t)
	d := defaultQuarterDesign()
	d.Name = "ربع قديم"
	if err := saveDesign(d); err != nil {
		t.Fatalf("الحفظ فشل: %v", err)
	}
	if err := setDesignRole(roleQuarter, "ربع قديم"); err != nil {
		t.Fatalf("الدور فشل: %v", err)
	}
	if err := renameDesign("ربع قديم", "ربع جديد"); err != nil {
		t.Fatalf("تغيير الاسم فشل: %v", err)
	}
	if got := designForRole(roleQuarter).Name; got != "ربع جديد" {
		t.Fatalf("الدور راح لـ%q بدل «ربع جديد»", got)
	}
	if got := activeDesign().Name; got != "ربع جديد" {
		t.Fatalf("المستخدم راح لـ%q بدل «ربع جديد»", got)
	}
}

// ⚠️ الافتراضي بيبان في القايمة وهو لسه مااتحفظش. تغيير اسمه لازم
// يشتغل، مش يقول "مافيش تصميم بالاسم ده".
func TestRenameWorksOnUnsavedDefault(t *testing.T) {
	withTempSettings(t)
	if err := renameDesign(defaultDesign().Name, "ملصق بتاعي"); err != nil {
		t.Fatalf("تغيير اسم الافتراضي فشل: %v", err)
	}
	if got := activeDesign().Name; got != "ملصق بتاعي" {
		t.Fatalf("المستخدم %q", got)
	}
}

func TestRenameRefusesDuplicateAndEmpty(t *testing.T) {
	withTempSettings(t)
	a, b := defaultDesign(), defaultDesign()
	a.Name, b.Name = "واحد", "اتنين"
	if err := saveDesign(a); err != nil {
		t.Fatal(err)
	}
	if err := saveDesign(b); err != nil {
		t.Fatal(err)
	}
	if err := renameDesign("واحد", "اتنين"); err == nil {
		t.Fatal("قبل اسم مكرر — كان هيخلّي تصميمين بنفس الاسم")
	}
	if err := renameDesign("واحد", "   "); err == nil {
		t.Fatal("قبل اسم فاضي")
	}
	if len(getSettings().Designs) != 2 {
		t.Fatalf("العدد اتغيّر: %d", len(getSettings().Designs))
	}
}

// ============================================================
// 🏷️ نوع التصميم جنب اسمه
// ============================================================
// اتطلب بالنص: "عاوز في اسم التصميم يبقي جنبه نوعه بمعني ملصق عادي
// مقسوم 4 بدون سعر".
func TestDesignerShowsRoleNextToName(t *testing.T) {
	for _, want := range []string{
		"ROLE_AR", "ملصق عادي", "مقسوم ٤", "من غير سعر",
		`id="dname-roles"`, "roleLabel", "showNameRoles",
		"/design/rename", "origName",
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("المصمّم مافيهوش: %s", want)
		}
	}
}

// ⚠️ الإعدادات في الذاكرة ومشتركة بين الفحوص. الحارس ده بيبدأ من
// صفحة بيضا وبيرجّع اللي كان بعد الفحص، عشان فحص مايكسرش اللي بعده.
func withTempSettings(t *testing.T) {
	t.Helper()
	setMu.RLock()
	prev := setData
	setMu.RUnlock()
	setMu.Lock()
	setData = settings{}
	setMu.Unlock()
	t.Cleanup(func() {
		setMu.Lock()
		setData = prev
		setMu.Unlock()
	})
}

// ============================================================
// 🤫 التحديث في صمت + المعاينة بتتطوي
// ============================================================
// اتطلب بالنص: "لما اضغط علي تحديث النظام المساعد من الهاتف ميفتحش
// الواجهة بعد ما البرنامج المساعد يتحدث يعني يتحدث في صمت في الخلفيه".
//
// ⚠️⚠️ من غير العلم ده، النسخة الجديدة بتشتغل من غير أي أمر — يعني
// زي ما المستخدم فتحها بإيده — فبتفتح صفحة البرنامج في المتصفح على
// كمبيوتر المحل، لأن حد دوس زرار من تليفونه.
func TestRestartAfterUpdateIsSilent(t *testing.T) {
	src, err := os.ReadFile("update_windows.go")
	if err != nil {
		t.Fatalf("مش قادر أقرا: %v", err)
	}
	if !strings.Contains(string(src), "exec.Command(exe, updatedFlag)") {
		t.Fatal("إعادة التشغيل مش بتبعت العلم — النسخة الجديدة هتفتح المتصفح")
	}

	m, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("مش قادر أقرا: %v", err)
	}
	ms := string(m)
	if !strings.Contains(ms, `updatedFlag = "--updated"`) {
		t.Fatal("العلم مش متعرّف")
	}
	// ⚠️ ولازم يتقرا **ويوقف الفتح**: العلم اللي مافيش حد بيقراه مالوش
	// أي أثر، والفحص لازم يمسك ده مش يكتفي بوجود الاسم.
	if !strings.Contains(ms, "afterUpdate = true") {
		t.Fatal("العلم مش بيتقرا في main")
	}
	if !strings.Contains(ms, "if afterUpdate {") {
		t.Fatal("العلم بيتقرا بس مش بيمنع الفتح")
	}
	// ⚠️⚠️ والأهم: الفحص لازم يتأكد إن الشرط **قبل** الفتح، مش بعده.
	iAfter := strings.Index(ms, "if afterUpdate {")
	iOpen := strings.Index(ms, `openBrowser("http://" + addr)`)
	if iAfter < 0 || iOpen < 0 || iAfter > iOpen {
		t.Fatalf("شرط ما-بعد-التحديث مش قبل الفتح: %d مقابل %d", iAfter, iOpen)
	}
}

// اتطلب بالنص: "لما اضغط اطبع تجربة لما يظهر معاينه المعاينه تدخل
// بردوا جوه حقل بيانات التجربة بمعني لما اطوي الحقل او اخفيه تختفي
// جواه معاهم".
func TestSentPreviewFoldsWithSampleFields(t *testing.T) {
	for _, want := range []string{
		"var sampleOpen = true, hasSent = false;",
		"function syncSent(){ $('sent-wrap').hidden = !(hasSent && sampleOpen); }",
		"hasSent = true;",
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("المصمّم مافيهوش: %s", want)
		}
	}
	// ⚠️ والطيّ لازم ينده syncSent، وإلا الصورة بتفضل ظاهرة بعد الطي
	i := strings.Index(designerPage, "function setSampleOpen(open){")
	j := strings.Index(designerPage[i:], "}")
	if i < 0 || !strings.Contains(designerPage[i:i+j], "syncSent();") {
		t.Fatal("الطيّ مش بيحدّث الصورة")
	}
}

// ============================================================
// ⛔ حد الأمان بيتقال **وانت بتحرّك**، مش عند الحفظ
// ============================================================
// اتبلّغ بالنص: "لما باجي بحفظ التصميم بيكتبلي ⚠️ السعر: خارج من
// الملصق من تحت ده اللي بيكتب بالرغم من ان اتطبع كويس وطلع في معاينة
// التجربة كويسه".
//
// ⚠️⚠️ والرسالة كانت **صح**: الاسم اتكبّر لـ6.3مم، فالفاضل للرقم
// والسعر 4.2مم وهما محتاجين 5.4 — يعني السعر بيعدّي خط الأمان بـ1.2مم.
// وطبع عادي لأن 0.7مم هامش أمان مش حد قص.
//
// فاللي اتصلّح مش القاعدة — اللي اتصلّح إن المستخدم يشوفها وهو
// بيحرّك، بدل ما يكتشفها بعد ما يخلص شغل.
func TestSafeEdgeShowsWhileDragging(t *testing.T) {
	for _, want := range []string{
		`id="outside"`,        // مكان التحذير
		"var SAFE_MM = 0.7;",  // نفس رقم البرنامج
		"مش هيتحفظ كده",       // نبرة مانع مش معلومة
		".el.out{",            // الصندوق المخالف بيتلوّن
		"outside.push(",       // وبيتجمّع فعلًا
	} {
		if !strings.Contains(designerPage, want) {
			t.Fatalf("تحذير الحدود ناقص: %s", want)
		}
	}
	// ⚠️⚠️ الرقم في الصفحة لازم يطابق البرنامج بالظبط، وإلا الشاشة
	// تقول تمام والحفظ يرفض — وده العطل الأصلي بعينه.
	if !strings.Contains(designerPage, fmt.Sprintf("var SAFE_MM = %.1f;", safeEdgeMm)) {
		t.Fatalf("رقم حد الأمان في الصفحة مش مطابق للبرنامج (%v)", safeEdgeMm)
	}
}

// ⚠️ والرسالة بتقول **كام** — اللي بيقراها واقف قدام خانات بالمليمتر.
func TestOutOfBoundsErrorSaysHowMuch(t *testing.T) {
	d := defaultDesign()
	for i := range d.Elements {
		if d.Elements[i].Kind == elPrice {
			d.Elements[i].Y = 10.0 // 10.0 + 2.9 = 12.9 > 12.5 - 0.7
		}
	}
	err := validateDesign(&d)
	if err == nil {
		t.Fatal("قبل عنصر خارج عن حد الأمان")
	}
	msg := err.Error()
	if !strings.Contains(msg, "خارج من الملصق من تحت") {
		t.Fatalf("رسالة مش متوقّعة: %s", msg)
	}
	// 10.0 + 2.9 - (12.5 - 0.7) = 1.10
	if !strings.Contains(msg, "1.10مم") {
		t.Fatalf("الرسالة مش بتقول كام: %s", msg)
	}
}
