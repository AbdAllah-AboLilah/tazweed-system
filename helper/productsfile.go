package main

// ============================================================
// 📦 ملف الأصناف — المراقبة والمناولة
// ============================================================
// اتطلب بالنص: "ممكن نربط المساعد ب الملف ولما يتغير اي حاجه في الملف
// يرفع الاصناف ل النظام بتاعنا".
//
// ⚠️⚠️ تقسيم الشغل هنا **مقصود**، ونفسه في كل حاجة في البرنامج:
//
//	البرنامج  →  إيدك على القرص: بيشوف الملف اتغيّر، وبيناوله
//	النظام    →  بيقرا الإكسل ويرفع (هو اللي معاه حساب السحابة)
//
// وليه مانقراش الإكسل هنا؟ لأن قراءة أعمدة الـERP بتاع المحل فيها
// فخين اتصلّحوا على بيانات حقيقية (الشرح عند PRODUCT_FIELDS في
// js/products.js): "سعر البيع" معناها **قبل** الخصم، و"القسم" معناها
// **الفرعي**. نسخة تانية من المنطق ده هنا معناها إنها هتختلف عنه يوم
// ما حد يعدّل واحدة وينسى التانية — وساعتها الملصقات بأسعار غلط.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ⚠️ سقف: الملف الحقيقي ~3 ميجا و47 ألف صنف. السقف بيمنع إن ملف
// غلط (فيديو مثلًا) يفضل يتقرا لحد ما الذاكرة تخلص.
const maxProductsFileBytes = 60 << 20

type productsFileState struct {
	Path        string `json:"path"`
	Exists      bool   `json:"exists"`
	Size        int64  `json:"size"`
	ModifiedMs  int64  `json:"modifiedMs"`
	Fingerprint string `json:"fingerprint"`
	// ============================================================
	// 🔢 الرقم القصير — ن٣
	// ============================================================
	// اتطلب بالنص: "ايه رايك تكتب جوه بعد التحديث تكتب جواه التاريخ
	// والوقت بحيث لو مش متاكد تبص جوه ملف الاكسل تلاقي ان نفس اللي
	// انت رفعته قبل كده ... او حتي تكتب اي دي ارقام مثلا".
	//
	// ⚠️⚠️ والحل مش إننا نكتب جوه الإكسل: الملف ده بيتولّد من
	// الـERP، وأي حاجة نكتبها جواه بتتمسح أول مرة يتصدّر تاني —
	// وكمان مش من حقنا نعدّل ملف بيطلع من برنامج تاني.
	//
	// فبدل ما نكتب جواه، بنطلّع منه: أول 8 حروف من بصمة الملف.
	// نفس الملف = نفس الرقم دايمًا، وأي حرف يتغيّر جواه = رقم
	// مختلف. تبص على الرقم في البرنامج وتبص عليه في النظام:
	// متطابقين يبقى اللي في النظام هو اللي في الملف.
	ShortCode  string `json:"shortCode,omitempty"`
	AutoUpload bool   `json:"autoUpload"`
	Error      string `json:"error,omitempty"`

	// 🕒 آخر رفع — الشرح عند ProductsLastUploadMs في settings.go
	LastUploadMs    int64 `json:"lastUploadMs,omitempty"`
	LastUploadCount int   `json:"lastUploadCount,omitempty"`
	// ⚠️ الرقم القصير بتاع **اللي اترفع**، مش بتاع اللي على القرص.
	// الاتنين مع بعض هما اللي بيقولوا لك: متطابقين = متزامن،
	// مختلفين = الملف اتغيّر بعد الرفع.
	LastUploadShort string `json:"lastUploadShort,omitempty"`
	// ⚠️ بيتحسب هنا مش في الصفحة: الصفحة مالهاش دعوة تقارن بصمات.
	ChangedSinceUpload bool `json:"changedSinceUpload"`

	// 📶 الرفع اللي شغّال دلوقتي (لو فيه)
	Progress *uploadProgress `json:"progress,omitempty"`
}

// ============================================================
// 📶 شريط التقدّم — والرفع أصلًا بيحصل في النظام مش هنا
// ============================================================
// اتطلب بالنص: "ممكن نعمل شريط تقدم في لمساعد عند الرفع".
//
// ⚠️⚠️ البرنامج **مابيرفعش**. اللي بيرفع هو النظام في المتصفح (هو
// اللي معاه حساب السحابة). فالبرنامج مايقدرش يعرف لوحده إن فيه رفع
// شغّال — لازم النظام يقوله.
//
// فالنظام بيبعت هنا: بدأت / وصلت لكذا من كذا / خلصت. والصفحة بتسأل
// كل ثانية وترسم الشريط.
//
// ⚠️ ومقفول بمهلة: لو المتصفح اتقفل في نص الرفع، الشريط مايفضلش
// شغّال للأبد — بيعتبر نفسه وقف بعد دقيقة من غير أي خبر.
const uploadStaleAfter = 60 * time.Second

type uploadProgress struct {
	Done  int    `json:"done"`
	Total int    `json:"total"`
	Error string `json:"error,omitempty"`
	// ⚠️ مابيتبعتش للصفحة: ده وقتنا إحنا عشان نعرف الخبر بايت ولا لأ
	at time.Time
}

var (
	upMu   sync.Mutex
	upCur  *uploadProgress
	upDone bool
)

// بترجّع نسخة من الحالة الشغّالة — أو nil لو مافيش رفع دلوقتي.
func currentUpload() *uploadProgress {
	upMu.Lock()
	defer upMu.Unlock()
	if upCur == nil {
		return nil
	}
	if time.Since(upCur.at) > uploadStaleAfter {
		upCur = nil
		return nil
	}
	c := *upCur
	return &c
}

// ⚠️ البصمة متخزّنة بالحجم والتاريخ: حساب sha256 لـ3 ميجا رخيص، بس
// النظام بيسأل كل شوية — فمفيش داعي نعيده والملف مااتغيّرش.
var (
	fpMu    sync.Mutex
	fpKey   string
	fpValue string
)

func fileFingerprint(path string, size int64, modMs int64) (string, error) {
	key := path + "|" + itoa(size) + "|" + itoa(modMs)
	fpMu.Lock()
	if key == fpKey && fpValue != "" {
		v := fpValue
		fpMu.Unlock()
		return v, nil
	}
	fpMu.Unlock()

	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, io.LimitReader(f, maxProductsFileBytes)); err != nil {
		return "", err
	}
	sum := hex.EncodeToString(h.Sum(nil))

	fpMu.Lock()
	fpKey, fpValue = key, sum
	fpMu.Unlock()
	return sum, nil
}

// ============================================================
// 🔢 الرقم القصير — 8 حروف من البصمة
// ============================================================
// ⚠️ ليه 8 مش 4 ولا 16: 8 حروف ست عشرية = 4 مليار احتمال، فاحتمال
// إن ملفين مختلفين يطلعوا بنفس الرقم مايستاهلش الحساب. و16 حرف
// مالهاش لازمة — الرقم ده بيتقارن **بالعين** بين شاشتين، وحرف زيادة
// معناه غلطة قراية زيادة.
//
// ⚠️⚠️ وبحروف كبيرة: الرقم بيتقرا من شاشة كمبيوتر وشاشة تليفون
// جنب بعض، و"b8" و"B8" لازم يبانوا واحد. hex أصلًا بيطلع صغير،
// فالتكبير بيخلّي الشكل ثابت في الاتنين.
func shortFP(fp string) string {
	if len(fp) < 8 {
		return ""
	}
	return strings.ToUpper(fp[:8])
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

func productsFileInfo() productsFileState {
	s := getSettings()
	out := productsFileState{
		Path:            s.ProductsFile,
		AutoUpload:      s.ProductsAutoUpload,
		LastUploadMs:    s.ProductsLastUploadMs,
		LastUploadCount: s.ProductsLastUploadCount,
		LastUploadShort: shortFP(s.ProductsLastUploadFP),
		Progress:        currentUpload(),
	}
	if strings.TrimSpace(out.Path) == "" {
		return out
	}
	st, err := os.Stat(out.Path)
	if err != nil {
		// ⚠️ بنقول السبب بالعربي: "الملف مش موجود" غير "مش عارف أفتحه"
		// (صلاحيات) — والاتنين بيتصلّحوا بطريقة مختلفة.
		if os.IsNotExist(err) {
			out.Error = "الملف مش موجود في المسار ده"
		} else {
			out.Error = "مش قادر أوصل للملف: " + err.Error()
		}
		return out
	}
	if st.IsDir() {
		out.Error = "ده مجلد مش ملف"
		return out
	}
	out.Exists = true
	out.Size = st.Size()
	out.ModifiedMs = st.ModTime().UnixNano() / int64(time.Millisecond)
	fp, err := fileFingerprint(out.Path, out.Size, out.ModifiedMs)
	if err != nil {
		out.Error = "مش قادر أقرا الملف: " + err.Error()
		return out
	}
	out.Fingerprint = fp
	out.ShortCode = shortFP(fp)
	// ⚠️ "اتغيّر بعد آخر رفع" = فيه رفع قبل كده، والبصمة دلوقتي مختلفة.
	// من غير الشرط الأول، أول مرة خالص كانت هتقول "اتغيّر" وهي عمرها
	// ما اترفعت أصلًا.
	out.ChangedSinceUpload = s.ProductsLastUploadFP != "" && s.ProductsLastUploadFP != fp
	return out
}

// GET /products/file/raw → الملف نفسه، عشان النظام يقراه
//
// ⚠️ بيرجّع 409 لو الملف مش موجود بدل ما يرجّع صفحة خطأ HTML —
// النظام بيقرا JSON، والرد الغلط بيطلّع خطأ غامض عنده.
func handleProductsFileRaw(w http.ResponseWriter, r *http.Request) {
	info := productsFileInfo()
	if !info.Exists {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusConflict)
		msg := info.Error
		if msg == "" {
			msg = "مافيش ملف أصناف متظبّط على الجهاز ده"
		}
		json.NewEncoder(w).Encode(map[string]string{"error": msg})
		return
	}
	f, err := os.Open(info.Path)
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	defer f.Close()
	// ⚠️ البصمة في الترويسة: النظام بيتأكد إن اللي نزّله هو نفس اللي
	// شافه في الحالة — الملف ممكن يتغيّر بين النداءين.
	w.Header().Set("X-Tazweed-Fingerprint", info.Fingerprint)
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	io.Copy(w, io.LimitReader(f, maxProductsFileBytes))
}

// ============================================================
// ✍️ تظبيط المسار — بالشاشة أو باللزق
// ============================================================

// ⚠️⚠️ "نسخ كمسار" في الويندوز بيحط المسار **بين علامتين اقتباس**:
//
//	"C:\Users\shop\Desktop\List.xlsx"
//
// ولو اتحفظ كده، os.Stat هيقول "الملف مش موجود" والمستخدم هيبص على
// مسار مكتوب صح ومش فاهم. فبنشيلهم — ده أكتر طريقة هياخد بيها المسار.
func cleanPath(p string) string {
	p = strings.TrimSpace(p)
	p = strings.Trim(p, "\"'")
	return strings.TrimSpace(p)
}

func setProductsFile(path string, auto bool) error {
	s := getSettings()
	s.ProductsFile = cleanPath(path)
	s.ProductsAutoUpload = auto
	return saveSettings(s)
}

type productsFileReq struct {
	// ⚠️ مؤشرات: الصفحة بتبعت اللي اتغيّر بس. من غير المؤشر، إرسال
	// المسار لوحده كان هيطفّي الرفع التلقائي في سكوت.
	Path       *string `json:"path"`
	AutoUpload *bool   `json:"autoUpload"`
}

// GET /products/file → حالة الملف (من غير محتواه)
// POST /products/file → يحفظ المسار و/أو الرفع التلقائي ويرجّع الحالة
func handleProductsFile(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		s := getSettings()
		var in productsFileReq
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "الطلب مش مفهوم"})
			return
		}
		path, auto := s.ProductsFile, s.ProductsAutoUpload
		if in.Path != nil {
			path = *in.Path
		}
		if in.AutoUpload != nil {
			auto = *in.AutoUpload
		}
		if err := setProductsFile(path, auto); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(productsFileInfo())
}

type pickReply struct {
	OK       bool              `json:"ok"`
	Canceled bool              `json:"canceled,omitempty"`
	State    productsFileState `json:"state"`
	Error    string            `json:"error,omitempty"`
}

// POST /products/file/pick → بيفتح شاشة الويندوز على الكمبيوتر نفسه
//
// ⚠️ بيفتح على مجلد الملف الحالي لو فيه واحد: اللي بيغيّر المسار
// غالبًا بيغيّره لملف جنبه.
func handleProductsFilePick(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, pickReply{Error: "POST بس"})
		return
	}
	start := ""
	if cur := cleanPath(getSettings().ProductsFile); cur != "" {
		start = filepath.Dir(cur)
	}
	path, err := pickFileDialog(start)
	if err != nil {
		writeJSON(w, http.StatusOK, pickReply{Error: err.Error(), State: productsFileInfo()})
		return
	}
	// ⚠️ المستخدم قفل الشاشة = مش خطأ، ومش سبب إننا نمسح المسار
	// القديم. بنسيبه زي ما هو.
	if path == "" {
		writeJSON(w, http.StatusOK, pickReply{OK: true, Canceled: true, State: productsFileInfo()})
		return
	}
	if err := setProductsFile(path, getSettings().ProductsAutoUpload); err != nil {
		writeJSON(w, http.StatusInternalServerError, pickReply{Error: err.Error(), State: productsFileInfo()})
		return
	}
	writeJSON(w, http.StatusOK, pickReply{OK: true, State: productsFileInfo()})
}

// ============================================================
// 📶 النظام بيقول للبرنامج إن الرفع ماشي
// ============================================================
// POST /products/file/progress
//
//	{"state":"start"}                        بدأ
//	{"state":"working","done":8,"total":24}  ماشي
//	{"state":"done","count":46969,"fingerprint":"..."}  خلص
//	{"state":"error","error":"..."}          وقع
type progressReq struct {
	State       string `json:"state"`
	Done        int    `json:"done"`
	Total       int    `json:"total"`
	Count       int    `json:"count"`
	Fingerprint string `json:"fingerprint"`
	Error       string `json:"error"`
}

func handleProductsFileProgress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
		return
	}
	var in progressReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "الطلب مش مفهوم"})
		return
	}

	switch in.State {
	case "start", "working":
		upMu.Lock()
		upCur = &uploadProgress{Done: in.Done, Total: in.Total, at: time.Now()}
		upMu.Unlock()
	case "error":
		// ⚠️ الغلط بيفضل باين شوية بدل ما يختفي: لو مسحناه على طول،
		// اللي كان بيبص على الشاشة يشوف الشريط بيختفي ومايعرفش ليه.
		upMu.Lock()
		upCur = &uploadProgress{Error: in.Error, at: time.Now()}
		upMu.Unlock()
	case "done":
		upMu.Lock()
		upCur = nil
		upMu.Unlock()
		// ⚠️⚠️ التاريخ بيتحفظ على القرص مش في الذاكرة: لازم يفضل
		// موجود بعد ما البرنامج يقفل ويفتح — ده المقصود من "تاريخ
		// اخر رفع".
		s := getSettings()
		s.ProductsLastUploadMs = time.Now().UnixNano() / int64(time.Millisecond)
		s.ProductsLastUploadCount = in.Count
		s.ProductsLastUploadFP = in.Fingerprint
		if err := saveSettings(s); err != nil {
			log.Println("تعذّر حفظ تاريخ آخر رفع:", err)
		}
		log.Printf("📦 ملف الأصناف اترفع من النظام: %d صنف\n", in.Count)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "حالة مش معروفة"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(productsFileInfo())
}
