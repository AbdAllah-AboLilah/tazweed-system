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
	"fmt"
	"math"
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

	// ⚠️ 1.2مم = نفس PRINT_SIZE_MM_MIN في js/print-core.js بالحرف.
	// تحت كده الحروف بتتلخبط على طابعة 203 نقطة/بوصة — الحرف بيبقى
	// أقل من 10 نقط وشكل الحرف العربي مابيبقاش واضح.
	minReadableMm = 1.2
)

// قيم "لو مايدخلش"
const (
	overflowShrink   = "shrink"
	overflowWrap     = "wrap"
	overflowEllipsis = "ellipsis"
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
	Name     string  `json:"name"`
	WidthMm  float64 `json:"widthMm"`
	HeightMm float64 `json:"heightMm"`
	Halves   int     `json:"halves"`

	// ============================================================
	// ⚠️⚠️ الأعمدة — ده اللي خلّى "مقسوم ٤" مش حالة خاصة
	// ============================================================
	// اتطلب بالنص: "بالنسبة مقسوم ٤ ايه اللي ممكن نعمله فيه وهل هيبقي
	// ليه حاجه ل تصميمه هو".
	//
	// والإجابة إنه **مش محتاج حاجة لوحده**: الفرق الوحيد بينه وبين
	// الملصق العادي إنه عمودين بدل عمود واحد.
	//
	//     ملصق واحد = صف × عمود        38 × 25 مم
	//     العادي     = صفين × عمود      38 × 12.5 مم
	//     مقسوم ٤    = صفين × عمودين    19 × 12.5 مم
	//
	// ⚠️ فاضي أو صفر = عمود واحد، عشان كل التصاميم المتخزّنة من قبل
	// الحقل ده تفضل شغّالة زي ما هي بالحرف.
	Cols int `json:"cols,omitempty"`

	// ⚠️ خط الملصق — معرّف من labelFonts في fonts.go. فاضي أو "system"
	// معناه خط الجهاز، وده الافتراضي: تصميم قديم متخزّن من غير الحقل
	// ده بيفضل شغّال زي ما هو بالظبط.
	Font string `json:"font,omitempty"`

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

			// ⚠️⚠️ السعرين **كل واحد في صندوقه**، والسعر بعد الخصم
			// على اليمين والقديم على الشمال. اتطلب بالنص:
			//   "المفروض السعر اللي هو بعد الخصم يبقي علي اليمين
			//    وقبل الخصم علي اليسار والاتنين يتحركوا لوحدهم"
			//
			// ⚠️ وX الأكبر = أبعد لليمين (الصناديق بتتحط بـleft).
			// فالقديم 12.5→21.5 والسعر 22.0→36.0، وبينهم 0.5مم.
			{Kind: elPrice, X: 22.0, Y: 8.8, W: 14.0, H: 2.9,
				FontMm: 2.4, Lines: 1, Align: "center", Weight: "bold", Overflow: "shrink", Show: "always"},

			// السعر القديم مشطوب، ومابيظهرش إلا لو فيه خصم.
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

// ⚠️ كل حدود التصميم بتتحسب على **الخلية** مش على الورقة: العنصر
// اللي في العمود الأول لازم يقف قبل خط القص الرأسي، مش قبل حرف
// الورقة. من غير كده، مقسوم ٤ كان هيسمح بعنصر يمشي على اللاصقتين.
func (d labelDesign) cellWidthMm() float64 {
	c := d.Cols
	if c < 1 {
		c = 1
	}
	return d.WidthMm / float64(c)
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
		return errors.New("عدد الصفوف لازم يبقى من 1 لـ4")
	}
	// ⚠️ فاضي = عمود واحد، عشان التصاميم القديمة تفضل صالحة.
	if d.Cols == 0 {
		d.Cols = 1
	}
	if d.Cols < 1 || d.Cols > 4 {
		return errors.New("عدد الأعمدة لازم يبقى من 1 لـ4")
	}
	if len(d.Elements) == 0 {
		return errors.New("التصميم فاضي — لازم يبقى فيه عنصر واحد على الأقل")
	}

	// ⚠️ الخط بيتملّى لو فاضي مش بيترفض: التصاميم المتخزّنة من نسخة
	// أقدم مافيهاش الحقل ده خالص، ومايصحّش تبقى فجأة "غير صالحة".
	if d.Font == "" {
		d.Font = defaultFontID
	}
	if fontByID(d.Font) == nil {
		// ⚠️⚠️ واسم خط مش معروف **بيترفض** مش بيتجاهل: لو سكتنا عليه،
		// التصميم هيتحفظ وهو بيقول "خط كذا" والملصق هيطلع بخط تاني —
		// وده بالظبط الكذب اللي المصمّم اتعمل عشان يمنعه.
		return errors.New("خط مش معروف: " + d.Font)
	}

	cellH := d.cellHeightMm()
	cellW := d.cellWidthMm()
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

		// ⚠️⚠️ تطبيع «لو مايدخلش» **قبل** فحص المقاس تحت: الفحص ده
		// بيفرّق بين اللي بيصغّر واللي بيتقص، فلو القيمة لسه فاضية
		// وقتها كان هيحكم على عنصر غلط.
		if e.Overflow == "" {
			e.Overflow = overflowShrink
		}
		if e.Overflow != overflowShrink && e.Overflow != overflowWrap && e.Overflow != overflowEllipsis {
			return errors.New(arabicKind(e.Kind) + ": خانة «لو مايدخلش» فيها قيمة مش معروفة")
		}

		// ---- حد الأمان على الحروف الأربعة ----
		if e.X < safeEdgeMm || e.Y < safeEdgeMm {
			return errors.New(arabicKind(e.Kind) + ": لازق في حرف الملصق — سيب 0.7مم على الأقل")
		}
		// ⚠️⚠️ **عرض الخلية** مش عرض الورقة. في مقسوم ٤ فيه خط قص
		// رأسي في نص الورقة، والعنصر اللي بيعدّيه بيتقص نصين — وده
		// نفس خطر خط القص الأفقي المكتوب تحت بالظبط.
		if e.X+e.W > cellW-safeEdgeMm {
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
		// ============================================================
		// ⚠️⚠️⚠️ الرفض هنا كان **غلط** — اقرا قبل ما ترجّعه
		// ============================================================
		// اتبلّغ بالنص:
		//   "انا جربت اخلي الاسم ينزل في ٣ سطور نزل عادي بس لما جيت
		//    احفظ التصميم قالي ان الحجم لازم يكبر بالرغم من في
		//    المعاينة قدامي علي الشاشة طلعت عادي مظبوطه وانا كنت راضي"
		//
		// وهو **صح**. كان فيه تناقض بين حاجتين في نفس البرنامج:
		//   • المعاينة بتصغّر الخط لحد ما يدخل وبتوريه نضيف
		//   • والحفظ بيرفض نفس التصميم
		//
		// والمعاينة هي اللي كانت بتقول الحقيقة: الملصق الحقيقي كمان
		// **بيصغّر** (overflow: shrink). يعني التصميم كان سليم
		// وبيتطبع كويس، والرفض كان بيمنع حاجة شغّالة.
		//
		// القاعدة الصح: المهم مش "هل الخط المطلوب يدخل؟" — المهم
		// **"هل اللي هيطلع بعد التصغير ينفع يتقرا؟"**
		fit := e.H / (float64(e.Lines) * 1.2) // أكبر خط يدخل في الطول
		switch {
		// ⚠️ اللي مابيصغّرش (بيتقص بنقط أو بينزل سطر وخلاص) لازم
		// يدخل بالمقاس المطلوب — غير كده بيضيع كلام فعلًا.
		case e.Overflow == overflowEllipsis && float64(e.Lines)*e.FontMm*1.2 > e.H+0.05:
			return fmt.Errorf(
				"%s: الخط أكبر من الصندوق و«لو مايدخلش» متظبطة على «اقصه بنقط» — يعني الكلام هيضيع."+
					" %d سطور × %.1fمم = %.1fمم، والصندوق %.1fمم."+
					" خليها «صغّره»، أو كبّر الطول لـ%.1fمم، أو صغّر الخط لـ%.1fمم.",
				arabicKind(e.Kind), e.Lines, e.FontMm,
				float64(e.Lines)*e.FontMm*1.2, e.H,
				math.Ceil(float64(e.Lines)*e.FontMm*1.2*10)/10, math.Floor(fit*10)/10,
			)

		// ⚠️⚠️ وده الرفض الوحيد اللي فضل: المساحة أصغر من إن **أي**
		// كلام يتقرا فيها. التصغير مش سحر — تحت 1.2مم الحروف بتتلخبط
		// على طابعة حرارية 203 نقطة/بوصة.
		case fit < minReadableMm:
			return fmt.Errorf(
				"%s: المساحة صغيرة أوي — %d سطور في %.1fمم معناها خط %.2fمم، وده أصغر من إنه يتقرا (%.1fمم)."+
					" قلّل السطور أو كبّر الطول لـ%.1fمم على الأقل.",
				arabicKind(e.Kind), e.Lines, e.H, fit, minReadableMm,
				math.Ceil(float64(e.Lines)*1.2*minReadableMm*10)/10,
			)
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
// ⚠️⚠️ فصل صندوق السعر عن صندوق السعر القديم — مرة واحدة
// ============================================================
// قبل كده السعرين كانوا بيترسموا **زوج متوسّط جوّه صندوق السعر**،
// وصندوق القديم مالوش مكان حقيقي: بيقول مقاس الخط وبس.
//
// اتبلّغ بالنص:
//   "السعر القديم اللي هو السعر قبل الخصم كان في الاول بيتحرك لوحده
//    دلوقتي مش بيتحرك من مكانه بقي مربوط بالسعر ... والمفروض السعر
//    اللي هو بعد الخصم يبقي علي اليمين وقبل الخصم علي اليسار
//    والاتنين يتحركوا لوحدهم"
//
// فبقى كل واحد في صندوقه. والمشكلة إن التصاميم **المحفوظة من قبل**
// صندوقيها فوق بعض (نفس X) — ولو رسمناهم كده الرقمين هيتراكبوا على
// الورق: "110L.E85 L.E". وده عطل حقيقي اتشاف على ملصق مطبوع.
//
// فبنفصلهم مرة واحدة وقت القراية: القديم على الشمال والسعر على
// اليمين، جوّه نفس المساحة اللي كانت للسعر بالظبط — يعني مافيش حاجة
// بتخرج من الملصق ولا بتاكل من الاسم.
//
// ⚠️ والدالة **مابتعملش حاجة** لو الصندوقين مفصولين أصلًا: يعني
// تشتغل مرة، وبعد ما يحفظ ماتلمسش شغله تاني.
func splitPrices(d labelDesign) labelDesign {
	pi, oi := -1, -1
	for i, e := range d.Elements {
		switch e.Kind {
		case elPrice:
			pi = i
		case elOldPrice:
			oi = i
		}
	}
	if pi < 0 || oi < 0 {
		return d
	}
	p, o := d.Elements[pi], d.Elements[oi]

	// متقاطعين فعلًا؟ (أفقيًا **و** رأسيًا). لو لأ، المستخدم فصلهم
	// بإيده خلاص ومالناش دعوة.
	if p.X+p.W <= o.X || o.X+o.W <= p.X {
		return d
	}
	if p.Y+p.H <= o.Y || o.Y+o.H <= p.Y {
		return d
	}

	left := math.Min(p.X, o.X)
	right := math.Max(p.X+p.W, o.X+o.W)
	total := right - left
	const gapMm = 0.5

	// عرض القديم: زي ما هو لو معقول، وإلا 40% من المساحة.
	oldW := o.W
	if oldW <= 0 || oldW > total*0.5 {
		oldW = total * 0.4
	}
	priceW := total - oldW - gapMm
	// ⚠️ مساحة مش كفاية للاتنين؟ نسيبها زي ما هي بدل ما نطلّع
	// صندوق بعرض سالب — الزوج المتراكب أهون من ملصق فاضي.
	if priceW < 1 || oldW < 1 {
		return d
	}

	els := make([]designElement, len(d.Elements))
	copy(els, d.Elements)
	els[oi].X, els[oi].W = left, oldW
	els[pi].X, els[pi].W = left+oldW+gapMm, priceW
	// نفس السطر للاتنين — كانوا أصلًا كده لما كانوا زوج.
	els[oi].Y, els[oi].H = p.Y, p.H
	d.Elements = els
	return d
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
			return splitPrices(d)
		}
	}
	// ⚠️ الاسم المستخدم اتمسح؟ نرجّع أول واحد بدل ما نرجّع فاضي —
	// الملصق لازم يطلع.
	return splitPrices(s.Designs[0])
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

// ============================================================
// ✏️ تغيير اسم تصميم — من غير ما يتعمل نسخة تانية
// ============================================================
// اتطلب بالنص: "وكان يبقي متاح اعدل اسم التصميم".
//
// ⚠️⚠️ وليه مسار مخصوص مش "احفظ بالاسم الجديد"؟ لأن الحفظ
// بيلاقي الاسم مش موجود فبيضيف **تصميم تاني**، والقديم بيفضل مكانه:
// تدوس احفظ مرة واحدة وتلاقي نسختين.
//
// ⚠️⚠️ والأخطر من كده: اللي بيشاور على الاسم القديم.
// s.ActiveDesign وs.DesignRoles فيهم **أسماء**، مش أرقام. فلو غيّرنا
// الاسم وسبناهم، الدور بيلاقي اسم مش موجود ويرجع للافتراضي **في
// سكوت** — يعني تغيّر اسم تصميم فتلاقي الملصق اتغيّر شكله وانت
// مش عارف ليه. فبيتحدّثوا هنا مع الاسم في نفس الحفظة.
func renameDesign(from, to string) error {
	from = strings.TrimSpace(from)
	to = strings.TrimSpace(to)
	if from == "" || to == "" {
		return errors.New("الاسم مايصحّش يبقى فاضي")
	}
	if from == to {
		return nil
	}
	s := getSettings()
	if _, ok := designByName(s, to); ok {
		return errors.New("فيه تصميم بالاسم ده خلاص — اختار اسم تاني")
	}

	s.Designs = copyDesigns(s.Designs)
	found := false
	for i := range s.Designs {
		if s.Designs[i].Name == from {
			s.Designs[i].Name = to
			found = true
			break
		}
	}
	// ⚠️ التصاميم الافتراضية بتبان في القايمة وهي **لسه مااتحفظتش**
	// (شوف handleDesignAll). فلو غيّر اسم واحد فيهم قبل ما يحفظه،
	// مش هنلاقيه — بنحفظه بالاسم الجديد بدل ما نقول "مش موجود".
	if !found {
		for _, def := range []labelDesign{defaultDesign(), defaultQuarterDesign()} {
			if def.Name == from {
				def.Name = to
				s.Designs = append(s.Designs, def)
				found = true
				break
			}
		}
	}
	if !found {
		return errors.New("مافيش تصميم بالاسم ده")
	}

	if s.ActiveDesign == from {
		s.ActiveDesign = to
	}
	// نسخة جديدة من الخريطة — نفس سبب copyDesigns بالحرف.
	roles := map[string]string{}
	for k, v := range s.DesignRoles {
		if v == from {
			v = to
		}
		roles[k] = v
	}
	s.DesignRoles = roles
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

	// ============================================================
	// ⚠️⚠️ الافتراضيين **دايمًا** في القايمة
	// ============================================================
	// من غير ده، اللي بيفتح البرنامج أول مرة كان بيلاقي تصميم واحد
	// بس — فحقل "مقسوم ٤" في الشاشة الرئيسية بيبقى فاضي ومفيش حاجة
	// يختارها، وهو أصلًا مش عارف إنه المفروض "يعمل" تصميم الأول.
	//
	// ⚠️ وبنضيفهم **بالاسم**: أول ما يحفظ تعديل على "ملصق المحل"،
	// المحفوظ بتاعه هو اللي بيبان مش الافتراضي بتاعنا.
	// ⚠️ بالفصل: لو المصمّم عرض الصندوقين فوق بعض والطباعة
	// بتفصلهم، الشاشة هتكذب. الشرح عند splitPrices.
	list := copyDesigns(s.Designs)
	for i := range list {
		list[i] = splitPrices(list[i])
	}
	for _, def := range []labelDesign{defaultDesign(), defaultQuarterDesign()} {
		if _, ok := designByName(s, def.Name); !ok {
			list = append(list, def)
		}
	}

	// ⚠️ الأدوار بتتحسب مش بترجع خام: الخانة الفاضية معناها "اتصرّف"،
	// والصفحة محتاجة تعرض اللي **هيتنفّذ فعلًا** مش الفراغ.
	roles := map[string]string{}
	for _, role := range []string{roleNormal, roleQuarter, roleNoPrice} {
		roles[role] = designForRole(role).Name
	}

	json.NewEncoder(w).Encode(map[string]any{
		"designs": list,
		"active":  activeDesign().Name,
		"roles":   roles,
		// اللي المستخدم اختاره بإيده (الفاضي = تلقائي)
		"picked": s.DesignRoles,
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

// POST /design/rename  {"from":"...","to":"..."}
func handleDesignRename(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		http.Error(w, `{"ok":false,"error":"الطريقة مش مدعومة"}`, http.StatusMethodNotAllowed)
		return
	}
	var in struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&in); err != nil {
		writeDesignErr(w, "مش قادر أقرا الطلب")
		return
	}
	if err := renameDesign(in.From, in.To); err != nil {
		writeDesignErr(w, err.Error())
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "name": strings.TrimSpace(in.To)})
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

// ============================================================
// 🎭 أنواع الملصق — أنهي تصميم بيتستخدم إمتى
// ============================================================
// اتطلب بالنص: "ممكن نعمل في البرنامج المساعد حقل ل المقسوم العادي
// اختار من التصاميم المتاحه ... وحقل تاني اختار التصميم ل مقسوم ٤".
const (
	roleNormal  = "normal"  // الملصق العادي
	roleQuarter = "quarter" // مقسوم ٤
	roleNoPrice = "noPrice" // لما الطبعة تكون من غير سعر
)

var knownRoles = map[string]bool{roleNormal: true, roleQuarter: true, roleNoPrice: true}

// ============================================================
// ⭐⭐ التصميم الافتراضي لمقسوم ٤
// ============================================================
// ⚠️ الأرقام محسوبة على **الخلية**: 19 × 12.5مم (ورقة 38×25 بصفين
// وعمودين). حد الأمان 0.7مم على الحروف الأربعة للخلية، مش للورقة.
//
// ⚠️⚠️ والـQR أصغر من اللي في الملصق العادي (6.2 بدل 9.5): الخلية
// نصّها بس. ده مش تقليل جودة — عدد مربعات الرمز هو هو، بس النقطة
// الواحدة بقت أصغر. لو الباركود طويل، جرّب اطبع وشوف القارئ بيمسكه
// ولا لأ **قبل** ما تعتمده على كتالوج كامل.
func defaultQuarterDesign() labelDesign {
	return labelDesign{
		Name:     "مقسوم ٤",
		WidthMm:  38,
		HeightMm: 25,
		Halves:   2,
		Cols:     2,
		Elements: []designElement{
			{Kind: elQR, X: 0.9, Y: 1.3, W: 6.2, H: 6.2},
			{Kind: elName, X: 7.6, Y: 1.0, W: 10.5, H: 4.4,
				FontMm: 1.5, Lines: 2, Align: "center", Weight: "normal", Overflow: overflowShrink, Show: "always"},
			{Kind: elCode, X: 7.6, Y: 5.6, W: 10.5, H: 2.5,
				FontMm: 1.9, Lines: 1, Align: "center", Weight: "normal", Overflow: overflowShrink, Show: "always"},
			{Kind: elPrice, X: 0.9, Y: 8.4, W: 17.2, H: 2.7,
				FontMm: 2.2, Lines: 1, Align: "center", Weight: "bold", Overflow: overflowShrink, Show: "always"},
		},
	}
}

func designByName(s settings, name string) (labelDesign, bool) {
	if name == "" {
		return labelDesign{}, false
	}
	for _, d := range s.Designs {
		if d.Name == name {
			// ⚠️ الفصل هنا كمان: ده الباب اللي كل التصاميم المحفوظة
			// بتخرج منه. الشرح عند splitPrices.
			return splitPrices(d), true
		}
	}
	return labelDesign{}, false
}

// ============================================================
// ⭐⭐⭐ سلسلة الرجوع — البرنامج عمره ما يرجّع "مافيش تصميم"
// ============================================================
// ⚠️⚠️ ده العقد بين البرنامج والنظام: النظام بيسأل "أنهي تصميم
// لنوع كذا؟" ولازم ياخد إجابة **دايمًا**. لو رجّعنا فاضي، الملصق
// بيقف — والمستخدم واقف قدام الماكينة.
//
//	normal   → المختار له، وإلا التصميم المستخدم، وإلا الافتراضي
//	quarter  → المختار له، وإلا أول تصميم بعمودين، وإلا افتراضي مقسوم ٤
//	noPrice  → المختار له، وإلا **نفس العادي** (والنظام بيخفي السعر)
func designForRole(role string) labelDesign {
	s := getSettings()
	if d, ok := designByName(s, s.DesignRoles[role]); ok {
		return d
	}
	switch role {
	case roleQuarter:
		// ⚠️ بندوّر على تصميم بعمودين: لو المستخدم عمل واحد ومااختارهوش
		// من القايمة، الأقرب لنيته إنه هو ده مش الافتراضي بتاعنا.
		for _, d := range s.Designs {
			if d.Cols > 1 {
				return splitPrices(d)
			}
		}
		return defaultQuarterDesign()
	case roleNoPrice:
		// ⚠️ مافيش تصميم مخصوص؟ نستخدم العادي — والنظام بيخفي السعر
		// بنفسه. ده اللي بيخلّي "من غير سعر" شغّالة من غير ما المستخدم
		// يعمل حاجة، وهو اللي اتطلب: "هل هيتم تنفيذ التصميم من غير
		// السعر ولا ده هيحتاج نعمله تصميم معين".
		return designForRole(roleNormal)
	default:
		return activeDesign()
	}
}

func setDesignRole(role, name string) error {
	if !knownRoles[role] {
		return errors.New("نوع ملصق مش معروف: " + role)
	}
	s := getSettings()
	// ⚠️ الفاضي مسموح ومعناه "ارجع للافتراضي" — مش خطأ.
	if name != "" {
		if _, ok := designByName(s, name); !ok {
			return errors.New("مافيش تصميم بالاسم ده")
		}
	}
	// ⚠️ نسخة جديدة من الخريطة مش تعديل في اللي راجعة من getSettings:
	// نفس سبب copyDesigns بالحرف — الخريطة جوّه النسخة لسه بتشاور على
	// نفس المكان، والتعديل فيها كان هيغيّر المحفوظ قبل ما نقرّر نحفظ.
	roles := map[string]string{}
	for k, v := range s.DesignRoles {
		roles[k] = v
	}
	if name == "" {
		delete(roles, role)
	} else {
		roles[role] = name
	}
	s.DesignRoles = roles
	return saveSettings(s)
}

// GET /design/for?role=normal|quarter|noPrice
func handleDesignFor(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	role := r.URL.Query().Get("role")
	if role == "" {
		role = roleNormal
	}
	if !knownRoles[role] {
		// ⚠️ نوع مش معروف (نسخة نظام أجدد من البرنامج) → نرجّع العادي
		// بدل ما نرجّع خطأ. الملصق لازم يطلع.
		role = roleNormal
	}
	d := designForRole(role)
	json.NewEncoder(w).Encode(map[string]any{
		"role": role,
		// ⚠️ النظام بيخفي السعر بنفسه في النوع ده — سواء التصميم
		// المخصوص مافيهوش سعر أصلًا أو كان راجع للعادي.
		"hidePrice": role == roleNoPrice,
		"design":    d,
	})
}

// POST /design/role  {"role":"quarter","name":"مقسوم ٤"}
func handleDesignRole(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method != http.MethodPost {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "POST بس"})
		return
	}
	var req struct {
		Role string `json:"role"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": "الطلب مش مفهوم"})
		return
	}
	if err := setDesignRole(req.Role, req.Name); err != nil {
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
