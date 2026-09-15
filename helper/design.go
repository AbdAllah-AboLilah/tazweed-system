package main

// ============================================================
// 🎨 تصميم الملصق — بيتحفظ هنا، والنظام بيقراه
// ============================================================
// اتطلب بالنص: "انا عاوزك تعمل المصمم في المساعد".
//
// ------------------------------------------------------------
// ⚠️⚠️ ليه البرنامج بيحفظ التصميم بس **مابيرسمش** الملصق
// ------------------------------------------------------------
// الخطة الأولى كانت إن البرنامج ده يرسم الملصق من الأول للآخر. واللي
// خلاني أغيّرها قبل ما أكتب سطر: **رسم العربي**.
//
// الحرف العربي بيتغيّر شكله حسب مكانه في الكلمة (أول/وسط/آخر/منفصل)،
// وفيه لامات مركّبة، والاسم فيه أرقام إنجليزي جوّه كلام عربي فبيحتاج
// ترتيب الاتجاهين. المتصفح بيعمل ده كله ببلاش وبإتقان، ولغة البرنامج
// ده مافيهاش حاجة جاهزة ليه خالص — يعني كنا هنكتب المحرّك ده بإيدينا،
// وهو أصعب جزء في الحكاية **ومحدش هيشوف منه حاجة**.
//
// والهدف الحقيقي من المصمّم مش "مين اللي بيرسم" — الهدف إن **الشكل
// يتحفظ في مكان واحد على الماكينة** بدل ما يبقى محفوظ في كل متصفح
// لوحده. وده اللي الملف ده بيعمله:
//
//     البرنامج  →  بيحفظ التصميم ويقدّمه على /design
//     النظام    →  بيقراه ويرسم بيه
//
// النتيجة اللي بتبان للمستخدم واحدة: شكل واحد لكل الأجهزة، وتحكّم
// بالمليمتر. والفرق إننا شِلنا أخطر جزء من السكة.
//
// ⚠️ ولو احتجنا الرسم في البرنامج يومًا ما (عشان نشيل المتصفح خالص)،
// التصميم هيبقى متخزّن هنا جاهز — يعني المسار ده مش بيقفل الباب ده.

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

// ============================================================
// أنواع العناصر — مقفولة على اللي الملصق بيعرضه فعلًا
// ============================================================
// ⚠️ قايمة مقفولة مش نص حر: النظام بيعرف يجيب البيانات دي بس، وأي
// اسم تاني معناه عنصر هيطلع فاضي على الورق من غير ما حد يعرف ليه.
const (
	elQR       = "qr"       // رمز QR
	elName     = "name"     // اسم الصنف
	elCode     = "code"     // رقم الباركود
	elPrice    = "price"    // السعر
	elOldPrice = "oldPrice" // السعر قبل الخصم (مشطوب)
)

var knownKinds = map[string]bool{
	elQR: true, elName: true, elCode: true, elPrice: true, elOldPrice: true,
}

// ============================================================
// حدود الأرقام — نفس حدود النظام بالظبط
// ============================================================
// ⚠️⚠️ الأرقام دي مش اختيارية: لو التصميم سمح بمقاس خط 20مم في ملصق
// 12.5مم، الملصق هيطلع فاضي أو مقصوص والمستخدم مش هيفهم ليه. والحد
// هنا **قبل الحفظ**، عشان الغلط مايتخزّنش من الأصل.
const (
	minFontMm = 1.0
	maxFontMm = 8.0
	minSideMm = 0.5
	maxSideMm = 200.0
	maxLines  = 4
)

// ============================================================
// ⚠️⚠️ حد الأمان — نفس القاعدة اللي اتطلبت للملصق بالنص
// ============================================================
// "خلي بالك من الفراغ اللي من جهة اليسار عشان الملصق ميبقاش علي الحافة
//
//	او ممكن ب اختلاف المكن او تحريف الملصق يختفي فيه حاجه"
//
// فالتصميم مايقدرش يحط عنصر ألزق من كده على أي حرف، مهما كتبت في
// الخانة. ده مش تحذير — ده مرفوض عند الحفظ.
const safeEdgeMm = 0.7

type designElement struct {
	Kind string `json:"kind"`

	// ⚠️ X من **الشمال** مش اليمين، حتى والملصق عربي: ده اتجاه لوحة
	// الرسم نفسها (والصورة والطابعة)، والواجهة هي اللي بتترجمه للمستخدم.
	// خلط الاتنين في الكود بيطلّع عناصر مقلوبة والسبب صعب يتلاقى.
	X float64 `json:"x"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	H float64 `json:"h"`

	FontMm float64 `json:"fontMm,omitempty"`
	Lines  int     `json:"lines,omitempty"`

	Align  string `json:"align,omitempty"`  // right | center | left
	Weight string `json:"weight,omitempty"` // normal | bold

	// لو النص مايدخلش في الصندوق: يصغّر / ينزل سطر / يتقص بنقط
	Overflow string `json:"overflow,omitempty"` // shrink | wrap | ellipsis

	// always = دايمًا، ifDiscount = لو فيه سعر قديم بس
	Show string `json:"show,omitempty"`
}

type labelDesign struct {
	Name     string          `json:"name"`
	WidthMm  float64         `json:"widthMm"`
	HeightMm float64         `json:"heightMm"`
	Halves   int             `json:"halves"`
	Elements []designElement `json:"elements"`
}

// ============================================================
// التصميم الافتراضي = الشكل اللي بيطبع دلوقتي
// ============================================================
// ⚠️⚠️ الأرقام دي **مقيسة من ملصق حقيقي اترسم**، مش مخترعة: ملصق
// 38×25 بملصقين (كل واحد 12.51مم)، وقراية الحبر من الصورة الناتجة
// طلعت كده:
//
//	⬜2.13  ⬛1.88 اسم  ⬜0.38  ⬛1.25 اسم
//	⬜1.00  ⬛1.63 رقم  ⬜1.25  ⬛1.63 سعر  ⬜1.38
//
// يعني اللي يفتح المصمّم أول مرة بيلاقي **ملصقه هو** قدامه، مش شكل
// غريب لازم يظبطه من الأول.
func defaultDesign() labelDesign {
	return labelDesign{
		Name:     "ملصق المحل",
		WidthMm:  38,
		HeightMm: 25,
		Halves:   2,
		Elements: []designElement{
			// الـQR: 9.5مم مربّع على الشمال
			{Kind: elQR, X: 2.0, Y: 1.5, W: 9.5, H: 9.5},

			// ⚠⚠ الاسم: **1.9مم على سطرين** — وده مش رقم اخترناه،
			// ده **سقف المساحة** وهو جوهر الشكوى اللي اتبلّغت:
			//   "عدلت وخليته ٢.٦ عشان الخط يكبر بس ده لما يكون الكلام قليل"
			//
			// الحسبة: سطرين × الخط × 1.2 لازم يدخلوا في طول الصندوق.
			// ففي 4.6مم متاحة → أقصى خط = 4.6 ÷ 2.4 = **1.9مم**.
			// 2.6 محتاج 6.24مم — مش موجودة في ملصق 12.5مم.
			//
			// ⭐ ودي فايدة المصمّم الحقيقية: الرقم بقى **باين قدامك**
			// وتقدر تكبّر صندوق الاسم على حساب السعر لو عايز، بدل ما
			// النظام ياخد القرار لوحده ويسكت.
			{Kind: elName, X: 12.5, Y: 1.2, W: 23.5, H: 4.6,
				FontMm: 1.9, Lines: 2, Align: "center", Weight: "normal", Overflow: "shrink", Show: "always"},

			{Kind: elCode, X: 12.5, Y: 5.9, W: 23.5, H: 2.9,
				FontMm: 2.4, Lines: 1, Align: "center", Weight: "normal", Overflow: "shrink", Show: "always"},

			{Kind: elPrice, X: 12.5, Y: 8.8, W: 23.5, H: 2.9,
				FontMm: 2.4, Lines: 1, Align: "center", Weight: "bold", Overflow: "shrink", Show: "always"},

			// السعر القديم مشطوب جنب الجديد، ومابيظهرش إلا لو فيه خصم.
			{Kind: elOldPrice, X: 12.5, Y: 8.8, W: 9.0, H: 2.9,
				FontMm: 2.0, Lines: 1, Align: "center", Weight: "normal", Overflow: "shrink", Show: "ifDiscount"},
		},
	}
}

// ارتفاع الملصق الواحد — الورقة مقسومة على عدد الملصقات فيها.
func (d labelDesign) cellHeightMm() float64 {
	h := d.Halves
	if h < 1 {
		h = 1
	}
	return d.HeightMm / float64(h)
}

// ============================================================
// ⚠️⚠️ الفحص قبل الحفظ — مش بعده
// ============================================================
// تصميم بايظ متخزّن معناه إن كل طبعة بعد كده بتطلع غلط، والمستخدم
// بيدوّر في المكان الغلط. فالرفض بيحصل وهو بيحفظ، ومعاه **سبب بالعربي
// يقوله يعمل إيه** — مش "غير صالح".
func validateDesign(d *labelDesign) error {
	if strings.TrimSpace(d.Name) == "" {
		return errors.New("التصميم لازم يبقى ليه اسم")
	}
	if d.WidthMm < 10 || d.WidthMm > maxSideMm {
		return errors.New("عرض الملصق لازم يبقى بين 10 و200 مم")
	}
	if d.HeightMm < 5 || d.HeightMm > maxSideMm {
		return errors.New("طول الملصق لازم يبقى بين 5 و200 مم")
	}
	if d.Halves < 1 || d.Halves > 4 {
		return errors.New("عدد الملصقات في الورقة لازم يبقى من 1 لـ4")
	}
	if len(d.Elements) == 0 {
		return errors.New("التصميم فاضي — لازم يبقى فيه عنصر واحد على الأقل")
	}

	cellH := d.cellHeightMm()
	seen := map[string]bool{}

	for i := range d.Elements {
		e := &d.Elements[i]
		if !knownKinds[e.Kind] {
			return errors.New("عنصر مش معروف: " + e.Kind)
		}
		// ⚠️ عنصر مكرر معناه إن واحد فيهم هيترسم فوق التاني — والمستخدم
		// هيشوف حبر متلخبط ومش هيعرف إن فيه اتنين.
		if seen[e.Kind] {
			return errors.New("العنصر مكرر في التصميم: " + arabicKind(e.Kind))
		}
		seen[e.Kind] = true

		if e.W < minSideMm || e.H < minSideMm {
			return errors.New(arabicKind(e.Kind) + ": المقاس صغير أوي")
		}

		// ---- حد الأمان على الحروف الأربعة ----
		if e.X < safeEdgeMm || e.Y < safeEdgeMm {
			return errors.New(arabicKind(e.Kind) + ": لازق في حرف الملصق — سيب 0.7مم على الأقل")
		}
		if e.X+e.W > d.WidthMm-safeEdgeMm {
			return errors.New(arabicKind(e.Kind) + ": خارج من الملصق من الجنب")
		}
		// ⚠️ الحد ده هو **خط القص** لما يكون في الورقة أكتر من ملصق،
		// وهو أخطر حد: الماكينة بتحسّ الفراغ بين اللاصقات بحسّاس وفيه
		// فرق بين ماكينة وماكينة.
		if e.Y+e.H > cellH-safeEdgeMm {
			return errors.New(arabicKind(e.Kind) + ": خارج من الملصق من تحت")
		}

		if e.Kind == elQR {
			continue // الـQR مالوش خط ولا سطور
		}

		if e.FontMm < minFontMm || e.FontMm > maxFontMm {
			return errors.New(arabicKind(e.Kind) + ": حجم الخط لازم يبقى بين 1 و8 مم")
		}
		if e.Lines < 1 {
			e.Lines = 1
		}
		if e.Lines > maxLines {
			return errors.New(arabicKind(e.Kind) + ": أقصى عدد سطور 4")
		}
		// ⚠️⚠️ الفحص ده هو اللي بيمنع أشهر غلطة في المصمّمات: خط 3مم
		// في صندوق 2مم. النص بيتقص والمستخدم بيفتكر إن الطابعة بايظة.
		// السطر محتاج تقريبًا 1.2 ضعف حجم الخط.
		if float64(e.Lines)*e.FontMm*1.2 > e.H+0.05 {
			return errors.New(arabicKind(e.Kind) + ": الخط أكبر من الصندوق — كبّر الطول أو صغّر الخط")
		}

		if e.Align == "" {
			e.Align = "center"
		}
		if e.Align != "right" && e.Align != "center" && e.Align != "left" {
			return errors.New(arabicKind(e.Kind) + ": التوسيط لازم يبقى يمين أو وسط أو شمال")
		}
		if e.Weight == "" {
			e.Weight = "normal"
		}
		if e.Weight != "normal" && e.Weight != "bold" {
			return errors.New(arabicKind(e.Kind) + ": سُمك الخط لازم يبقى عادي أو عريض")
		}
		if e.Overflow == "" {
			e.Overflow = "shrink"
		}
		if e.Overflow != "shrink" && e.Overflow != "wrap" && e.Overflow != "ellipsis" {
			return errors.New(arabicKind(e.Kind) + ": خانة «لو مايدخلش» فيها قيمة مش معروفة")
		}
		if e.Show == "" {
			e.Show = "always"
		}
		if e.Show != "always" && e.Show != "ifDiscount" {
			return errors.New(arabicKind(e.Kind) + ": خانة «يظهر لو» فيها قيمة مش معروفة")
		}
	}

	// ⚠️ الاسم لازم يبقى موجود: ملصق من غير اسم صنف مالوش معنى، والمستخدم
	// ممكن يمسحه بالغلط وهو بيجرّب.
	if !seen[elName] {
		return errors.New("لازم يبقى في التصميم «اسم الصنف»")
	}
	return nil
}

func arabicKind(k string) string {
	switch k {
	case elQR:
		return "رمز QR"
	case elName:
		return "اسم الصنف"
	case elCode:
		return "رقم الباركود"
	case elPrice:
		return "السعر"
	case elOldPrice:
		return "السعر القديم"
	}
	return k
}

// ============================================================
// التصميم المستخدم — وده اللي النظام بيقراه
// ============================================================
func activeDesign() labelDesign {
	s := getSettings()
	if len(s.Designs) == 0 {
		return defaultDesign()
	}
	for _, d := range s.Designs {
		if d.Name == s.ActiveDesign {
			return d
		}
	}
	// ⚠️ الاسم المستخدم اتمسح؟ نرجّع أول واحد بدل ما نرجّع فاضي —
	// الملصق لازم يطلع.
	return s.Designs[0]
}

// ⚠⚠ كل دوال الحفظ بتمشي بنفس الطريقة: تقرا نسخة، تعدّل عليها،
// تكتبها كلها. ودي مش زوّاقة — saveSettings بتقفل القفل بنفسها،
// فلو قفلنا قبلها البرنامج كله بيتعلّق.
//
// ⚠️ وبننسخ القايمة نفسها مش بنشير ليها: getSettings بترجّع نسخة
// من الصندوق بس القايمة جوّاه لسه بتشاور على نفس المكان — والتعديل
// فيها مباشرة كان هيغيّر المحفوظ قبل ما نقرّر نحفظ أصلًا.
func copyDesigns(in []labelDesign) []labelDesign {
	out := make([]labelDesign, len(in))
	copy(out, in)
	return out
}

// بيحفظ تصميم (جديد أو بديل لواحد بنفس الاسم) ويخليه المستخدم.
func saveDesign(d labelDesign) error {
	if err := validateDesign(&d); err != nil {
		return err
	}
	s := getSettings()
	s.Designs = copyDesigns(s.Designs)
	found := false
	for i := range s.Designs {
		if s.Designs[i].Name == d.Name {
			s.Designs[i] = d
			found = true
			break
		}
	}
	if !found {
		s.Designs = append(s.Designs, d)
	}
	s.ActiveDesign = d.Name
	return saveSettings(s)
}

func deleteDesign(name string) error {
	s := getSettings()
	out := make([]labelDesign, 0, len(s.Designs))
	for _, d := range s.Designs {
		if d.Name != name {
			out = append(out, d)
		}
	}
	// ⚠️ مانسيبش القايمة فاضية وخلاص: لو مسح آخر تصميم، بيرجع
	// الافتراضي — عشان النظام مايلاقيش نفسه من غير تصميم فجأة.
	if len(out) == 0 {
		s.Designs = nil
		s.ActiveDesign = ""
	} else {
		s.Designs = out
		if s.ActiveDesign == name {
			s.ActiveDesign = out[0].Name
		}
	}
	return saveSettings(s)
}

func setActiveDesign(name string) error {
	s := getSettings()
	ok := false
	for _, d := range s.Designs {
		if d.Name == name {
			ok = true
			break
		}
	}
	if !ok {
		return errors.New("مافيش تصميم بالاسم ده")
	}
	s.ActiveDesign = name
	return saveSettings(s)
}

// ============================================================
// المسارات
// ============================================================
// GET  /design         → التصميم المستخدم (ده اللي النظام بيندهه)
// GET  /design/all     → كل التصاميم + اسم المستخدم منهم
// POST /design         → يحفظ تصميم ويخليه المستخدم
// POST /design/active  → يبدّل المستخدم  {"name":"..."}
// POST /design/delete  → يمسح تصميم      {"name":"..."}
func handleDesign(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if r.Method == http.MethodGet {
		json.NewEncoder(w).Encode(activeDesign())
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, `{"ok":false,"error":"الطريقة مش مدعومة"}`, http.StatusMethodNotAllowed)
		return
	}

	var d labelDesign
	// ⚠️ حد على حجم الجسم: التصميم بايتات قليلة، وأي حاجة أكبر من كده
	// غلط أو محاولة تتعب البرنامج.
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&d); err != nil {
		writeDesignErr(w, "مش قادر أقرا التصميم")
		return
	}
	if err := saveDesign(d); err != nil {
		writeDesignErr(w, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "name": d.Name})
}

func handleDesignAll(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	s := getSettings()
	list := s.Designs
	if len(list) == 0 {
		list = []labelDesign{defaultDesign()}
	}
	json.NewEncoder(w).Encode(map[string]any{
		"designs": list,
		"active":  activeDesign().Name,
	})
}

func handleDesignActive(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		http.Error(w, `{"ok":false,"error":"الطريقة مش مدعومة"}`, http.StatusMethodNotAllowed)
		return
	}
	var in struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&in); err != nil {
		writeDesignErr(w, "مش قادر أقرا الطلب")
		return
	}
	if err := setActiveDesign(in.Name); err != nil {
		writeDesignErr(w, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "active": in.Name})
}

func handleDesignDelete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		http.Error(w, `{"ok":false,"error":"الطريقة مش مدعومة"}`, http.StatusMethodNotAllowed)
		return
	}
	var in struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&in); err != nil {
		writeDesignErr(w, "مش قادر أقرا الطلب")
		return
	}
	deleteDesign(in.Name)
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "active": activeDesign().Name})
}

// ⚠️ الرد 200 مش 400 عن قصد: الواجهة بتقرا `ok` وبتعرض `error` للمستخدم
// بالعربي. الكود 400 كان بيخلّي المتصفح يرمي قبل ما نوصل للرسالة.
func writeDesignErr(w http.ResponseWriter, msg string) {
	json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": msg})
}
