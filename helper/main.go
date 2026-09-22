package main

// ============================================================
// 🖨️ مساعد التزويد — خادم صغير على الجهاز
// ============================================================
// النظام (في المتصفح) بينده عليه وقت الطباعة بس. مافيش استماع ولا
// نبضات ولا أي شغل في الخلفية — عشان مايأثرش على سرعة النظام خالص.
//
// ⚠️⚠️ الأمان — تلات حاجات لازم يفضلوا:
//
//   ١) **بيسمع على 127.0.0.1 بس** مش على 0.0.0.0. يعني مافيش جهاز
//      تاني على الشبكة يقدر يوصله أصلًا، حتى لو عرف البورت.
//
//   ٢) **قايمة مصادر مقفولة**: الموقع بتاعنا والتجربة المحلية وبس.
//      من غير كده أي صفحة تفتحها في نفس المتصفح تقدر تطبع على
//      طابعتك من غير ما تعرف.
//
//   ٣) **حد لحجم الطلب**: من غير كده صفحة خبيثة تبعت جيجا وتقفل
//      الذاكرة.

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	version = "1.23.0"
	addr    = "127.0.0.1:7770"
	// 12 ميجا: ورقة التزويد كصورة أبيض وأسود بتطلع كام عشرة كيلو،
	// فده سقف واسع جدًا وبرضه بيمنع الاستهلاك.
	maxBody = 12 << 20
)

// ⚠️ عنوان النظام — نفس المصدر المسموح تحت. مكتوب مرة واحدة عشان
// مايختلفش بين الحارس وبين اللي بيفتح.
const systemURL = "https://abdallah-abolilah.github.io/tazweed-system/"

// ⚠️ العلم اللي النسخة الجديدة بتتشغّل بيه بعد التحديث: معناه
// "اشتغل من غير ما تفتح أي حاجة". الشرح عند restartSelf.
const updatedFlag = "--updated"

// المصادر المسموح لها تنده. أي حاجة غيرها بتترفض.
var allowedOrigins = map[string]bool{
	"https://abdallah-abolilah.github.io": true,
	// للتجربة المحلية وإحنا بنطوّر
	"http://localhost:8899": true,
	"http://127.0.0.1:8899": true,
	// ⚠️ صفحة التجربة اللي البرنامج نفسه بيقدّمها — نفس المصدر.
	// من غير السطرين دول الصفحة بتترفض من الحارس بتاعها هي.
	"http://127.0.0.1:7770": true,
	"http://localhost:7770": true,
}

// ⚠️⚠️ الطلب اللي **من غير** ترويسة Origin
// ------------------------------------------------------------
// أول نسخة كانت بترفضه، والنتيجة إن **صفحة التجربة بتاعة البرنامج
// نفسه** اترفضت وطلّعت: «مش قادر أقرا الحالة: غير مسموح».
//
// السبب: المتصفح **مابيبعتش** Origin في طلب GET من **نفس العنوان**.
// فالصفحة اللي البرنامج بيقدّمها بتنده على /status من غير الترويسة.
//
// والقبول ده **مش** ثغرة: أي صفحة على موقع تاني بتبعت Origin
// إجباريًا — المتصفح هو اللي بيحطها ومحدش يقدر يمنعها. فاللي بيوصل
// من غير Origin يبقى: نفس الصفحة، أو برنامج على الجهاز نفسه (وده
// أصلًا شغّال على الماكينة وعنده وصول كامل ليها من غيرنا).
//
// وبنشدّها أكتر بـSec-Fetch-Site لما تكون موجودة: لو المتصفح قال
// إن الطلب من موقع تاني، بنرفض حتى لو Origin فاضية.
func originAllowed(o string) bool {
	if o == "" {
		return true
	}
	return allowedOrigins[strings.TrimSuffix(o, "/")]
}

// بترجّع true لو المتصفح قال صراحةً إن الطلب جاي من موقع تاني.
func crossSite(r *http.Request) bool {
	site := r.Header.Get("Sec-Fetch-Site")
	return site == "cross-site" || site == "same-site"
}

// ⚠️⚠️ `Access-Control-Allow-Private-Network` مش رفاهية:
// كروم بقى بيمنع الصفحات العامة إنها تنده على عناوين محلية إلا لو
// الرد فيه الترويسة دي في طلب الـpreflight. من غيرها البرنامج
// هيشتغل تمام والنظام مش هيوصله — والخطأ في الكونسول غامض.
func setCORS(w http.ResponseWriter, origin string) {
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Private-Network", "true")
	// ⚠️⚠️ من غير السطر ده، الصفحة **مش بتشوف** أي ترويسة من عندنا
	// غير الستة المعروفة (Content-Type وإخواتها). ده مش خطأ في
	// المتصفح — ده الافتراضي في CORS.
	//
	// والعطل اللي طلّعه اتقاس في متصفح حقيقي: بصمة ملف الأصناف
	// بتترجع في X-Tazweed-Fingerprint، والصفحة كانت بتقراها **فاضية**،
	// فبتحفظ بصمة فاضية — ونفس الملف (47 ألف صنف، 24 كتابة) كان
	// هيترفع من أول وجديد **كل مرة النظام يفتح**.
	w.Header().Set("Access-Control-Expose-Headers", "X-Tazweed-Fingerprint")
	w.Header().Set("Access-Control-Max-Age", "600")
}

func guard(next func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" && crossSite(r) {
			http.Error(w, "غير مسموح", http.StatusForbidden)
			return
		}
		if !originAllowed(origin) {
			// مانقولش السبب بالتفصيل لصفحة مش مسموح لها
			http.Error(w, "غير مسموح", http.StatusForbidden)
			return
		}
		setCORS(w, origin)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxBody)
		next(w, r)
	}
}

type statusReply struct {
	App            string   `json:"app"`
	Version        string   `json:"version"`
	OS             string   `json:"os"`
	Printers       []string `json:"printers"`
	RestockPrinter string   `json:"restockPrinter"`
	LabelPrinter   string   `json:"labelPrinter"`
	Autostart      bool     `json:"autostart"`
	// ⚠️ بترجع **القيم الفعلية** (الإعداد أو الافتراضي) مش الخام:
	// الصفحة لازم تعرض اللي هيتبعت للطابعة فعلًا، مش خانة فاضية.
	LabelGapMm     float64 `json:"labelGapMm"`
	LabelDirection int     `json:"labelDirection"`
	LabelFlip      bool    `json:"labelFlip"`
	// 🩺 مفتاح "اوقف الطبعة لو الطابعة مبلّغة مشكلة"
	StopOnPrinterProblem bool `json:"stopOnPrinterProblem"`
	OpenSystemOnStart    bool `json:"openSystemOnStart"`
	// 🆔 معرّف الماكينة — الشرح الكامل عند MachineID في settings.go.
	// باختصار: النظام بياخد منه رقم ثابت للكمبيوتر بدل الرقم العشوائي
	// اللي كل متصفح بيولّده لنفسه، فالجهاز يتحسب **مرة واحدة**.
	MachineID string `json:"machineId"`
	// 🏷️ اسم الجهاز المكتوب في البرنامج — النظام بياخده كاسم افتراضي
	// للماكينة، فالاسم بيبقى واحد على كل المتصفحات.
	DeviceName string `json:"deviceName"`
	// 📦 ملف الأصناف — النظام بيشوف من هنا إن الجهاز ده عليه ملف
	// ومراقب، من غير ما يسأل على /products/file لوحده.
	ProductsFile       string `json:"productsFile"`
	ProductsAutoUpload bool   `json:"productsAutoUpload"`
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	printers, err := listPrinters()
	if err != nil {
		log.Println("تعذّرت قراءة الطابعات:", err)
		printers = []string{}
	}
	cur := getSettings()
	gapMm, direction, flip := labelOptions()
	writeJSON(w, http.StatusOK, statusReply{
		App: "tazweed-helper", Version: version, OS: osName(), Printers: printers,
		MachineID:      machineID(),
		DeviceName:     cur.DeviceName,
		RestockPrinter: cur.RestockPrinter, LabelPrinter: cur.LabelPrinter,
		Autostart:            autostartEnabled(),
		LabelGapMm:           gapMm,
		LabelDirection:       direction,
		LabelFlip:            flip,
		StopOnPrinterProblem: cur.StopOnPrinterProblem,
		OpenSystemOnStart:    cur.OpenSystemOnStart,
		ProductsFile:         cur.ProductsFile,
		ProductsAutoUpload:   cur.ProductsAutoUpload,
	})
}

type printRequest struct {
	Printer string `json:"printer"`
	PNG     string `json:"png"`  // base64، من غير ترويسة data:
	Cut     *bool  `json:"cut"`  // فاضي = يقص
	Name    string `json:"name"` // اسم أمر الطباعة في طابور الويندوز
	// ⚠️⚠️ الورقة التجريبية **مابتتحفظش** في الأوراق المحفوظة:
	// محلّات الحفظ 20 بس، وورقة بعلامات المسطرة لو أكلت مكان ورقة
	// تزويد حقيقية تبقى الميزة ضرّت بدل ما تنفع. بتتسجّل في السجل
	// عادي (عشان تعرف إنك جرّبت) من غير ملف.
	Test bool `json:"test"`
}

type printReply struct {
	OK     bool   `json:"ok"`
	Bytes  int    `json:"bytes"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Error  string `json:"error,omitempty"`
}

func handlePrint(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, printReply{Error: "POST بس"})
		return
	}
	var req printRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "الطلب مش مفهوم: " + err.Error()})
		return
	}
	printer := pickPrinter(strings.TrimSpace(req.Printer), "restock")
	if printer == "" {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "مافيش طابعة متظبطة لورقة التزويد"})
		return
	}
	raw, err := decodePNG(req.PNG)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "الصورة مش base64 سليمة"})
		return
	}

	cut := true
	if req.Cut != nil {
		cut = *req.Cut
	}
	data, wpx, hpx, err := pngToESCPOS(raw, cut)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, printReply{Error: err.Error(), Width: wpx, Height: hpx})
		return
	}

	jobName := req.Name
	if jobName == "" {
		jobName = "ورقة تزويد"
	}
	kind := "restock"
	if req.Test {
		kind = "test"
	}
	if err := printRaw(printer, data, jobName); err != nil {
		log.Println("فشل الإرسال للطابعة:", err)
		// ⚠️ الفشل بيتسجّل زي النجاح: الحالة اللي بتوجع هي "أنا
		// دوست ومافيش ورقة طلعت" — والسطر ده هو اللي بيقول ليه.
		addPrintLog(printLogEntry{Kind: kind, Printer: printer, Name: jobName, Error: err.Error()})
		writeJSON(w, http.StatusInternalServerError, printReply{Error: err.Error()})
		return
	}
	log.Printf("اتطبعت: %s — %dx%d نقطة، %d بايت\n", printer, wpx, hpx, len(data))
	// ⚠️⚠️ بعد الطباعة خالص. الشرح في printlog.go: السجل عمره ما
	// يوقّف الطبعة.
	sheet := ""
	if !req.Test {
		sheet = saveSheet(raw)
	}
	addPrintLog(printLogEntry{Kind: kind, Printer: printer, Name: jobName,
		Bytes: len(data), OK: true, Sheet: sheet, Cut: cut})
	writeJSON(w, http.StatusOK, printReply{OK: true, Bytes: len(data), Width: wpx, Height: hpx})
}

// ============================================================
// 🏷️ الملصقات — نفس الفكرة، بلغة تانية
// ============================================================
// ⚠️⚠️ مسار **منفصل تمامًا** عن /print عن قصد: ورقة التزويد شغّالة
// ومجرّبة على ورق حقيقي، ومايصحّش نلمس سطر واحد من مسارها عشان
// نضيف الملصق. الاتنين مابيشاركوش غير قراءة الـPNG.
//
// الفرق عن /print:
//   - ESC/POS → TSPL (لغة طابعة الملصق)
//   - صورة واحدة → قايمة صور، كل واحدة بعددها
//   - العدد بيتنفّذ **جوه الطابعة** مش بتكرار الصورة
type labelItem struct {
	PNG    string `json:"png"`
	Copies int    `json:"copies"`
}

type labelRequest struct {
	Printer  string      `json:"printer"`
	WidthMm  float64     `json:"widthMm"`
	HeightMm float64     `json:"heightMm"`
	Labels   []labelItem `json:"labels"`
	Name     string      `json:"name"`
	Test     bool        `json:"test"` // الشرح عند printRequest.Test
}

type labelReply struct {
	OK     bool   `json:"ok"`
	Bytes  int    `json:"bytes"`
	Count  int    `json:"count"` // عدد اللاصقات اللي هتخرج فعلًا
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Error  string `json:"error,omitempty"`
}

func handleLabel(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, labelReply{Error: "POST بس"})
		return
	}
	var req labelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, labelReply{Error: "الطلب مش مفهوم: " + err.Error()})
		return
	}
	printer := pickPrinter(strings.TrimSpace(req.Printer), "label")
	if printer == "" {
		writeJSON(w, http.StatusBadRequest, labelReply{Error: "مافيش طابعة متظبطة للملصق"})
		return
	}
	if len(req.Labels) == 0 {
		writeJSON(w, http.StatusBadRequest, labelReply{Error: "مافيش ملصقات في الطلب"})
		return
	}

	items := make([]tsplLabel, 0, len(req.Labels))
	total := 0
	for i, it := range req.Labels {
		raw, err := decodePNG(it.PNG)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, labelReply{Error: fmt.Sprintf("ملصق %d: الصورة مش base64 سليمة", i+1)})
			return
		}
		copies := it.Copies
		if copies < 1 {
			copies = 1
		}
		items = append(items, tsplLabel{PNG: raw, Copies: copies})
		total += copies
	}

	gapMm, direction, flip := labelOptions()
	data, wpx, hpx, err := buildTSPLJob(items, req.WidthMm, req.HeightMm, gapMm, direction, flip)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, labelReply{Error: err.Error(), Width: wpx, Height: hpx})
		return
	}

	// ============================================================
	// 🩺 الحارس: نوقف قبل ما نضيّع رول
	// ============================================================
	// ⚠️⚠️ **مقفول افتراضيًا** عن قصد. اللي بيرجع من التعريف مش
	// مضمون: تعريف بيكدب ويقول "الورق خلص" وهو مافيش هيوقف الطباعة
	// خالص — وده أسوأ بكتير من إننا مانعرفش.
	//
	// فالمستخدم بيجرّب التشخيص الأول من الصفحة (والرول خارج)، ولما
	// يتأكد إن ماكينته بتبلّغ صح، يفتح المفتاح.
	if getSettings().StopOnPrinterProblem {
		if st := readPrinterState(printer); st.Blocking {
			log.Println("الطبعة اتوقفت:", st.Summary())
			writeJSON(w, http.StatusOK, labelReply{Error: st.Summary() + " — الطبعة اتوقفت قبل ما تضيّع ورق."})
			return
		}
	}

	jobName := req.Name
	if jobName == "" {
		jobName = "ملصقات"
	}
	lkind := "label"
	if req.Test {
		lkind = "test"
	}
	if err := printRaw(printer, data, jobName); err != nil {
		log.Println("فشل إرسال الملصقات للطابعة:", err)
		addPrintLog(printLogEntry{Kind: lkind, Printer: printer, Name: jobName, Count: total, Error: err.Error()})
		writeJSON(w, http.StatusInternalServerError, labelReply{Error: err.Error()})
		return
	}
	log.Printf("اتطبعت ملصقات: %s — %d لاصقة، %dx%d نقطة، %d بايت\n", printer, total, wpx, hpx, len(data))
	// ⚠️ الملصقات مابنحفظش صورها: ده 200 لاصقة في الطبعة الواحدة،
	// والفايدة من "اطبعها تاني" هنا قليلة — اللي بيتعاد هو ورق
	// التزويد. السطر بيتسجّل بعدده وبس.
	addPrintLog(printLogEntry{Kind: lkind, Printer: printer, Name: jobName,
		Count: total, Bytes: len(data), OK: true})
	writeJSON(w, http.StatusOK, labelReply{OK: true, Bytes: len(data), Count: total, Width: wpx, Height: hpx})
}

// ⚠️ بنقبل الترويسة `data:image/png;base64,` لو جت بالغلط بدل ما
// نفشل بسببها.
func decodePNG(s string) ([]byte, error) {
	if i := strings.Index(s, "base64,"); i >= 0 {
		s = s[i+7:]
	}
	return base64.StdEncoding.DecodeString(strings.TrimSpace(s))
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func newServer() *http.ServeMux {
	mux := http.NewServeMux()
	// ⚠️ الصفحة نفسها من غير الحارس: هي مش بتطبع، بس بتتعرض. والنداء
	// على /print اللي جواها بيعدّي على الحارس زي أي حد تاني.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(testPage))
	})
	mux.HandleFunc("/status", guard(handleStatus))
	mux.HandleFunc("/print", guard(handlePrint))
	mux.HandleFunc("/label", guard(handleLabel))
	// 🔒 حجز الطلب — الشرح الكامل في claim.go
	mux.HandleFunc("/claim", guard(handleClaim))
	// 🩺 حالة الطابعة — الحاجة اللي المتصفح مايقدرش عليها
	mux.HandleFunc("/printer/status", guard(handlePrinterStatus))
	// ⏳ الطابور الواقف — الشرح في queuewatch.go
	mux.HandleFunc("/printer/queue", guard(handlePrinterQueue))

	// 🧾 سجل الطباعة المحلي والأوراق المحفوظة — الشرح في printlog.go
	mux.HandleFunc("/print/log", guard(handlePrintLog))
	mux.HandleFunc("/print/log/clear", guard(handlePrintLogClear))
	mux.HandleFunc("/print/sheet", guard(handleSheetFile))
	mux.HandleFunc("/print/sheet/reprint", guard(handleSheetReprint))

	// ============================================================
	// 📦 ملف الأصناف — الشرح الكامل في productsfile.go
	// ============================================================
	// ⚠️ البرنامج بيراقب ويناول بس. النظام هو اللي بيقرا الإكسل
	// ويرفع — عشان منطق قراءة أعمدة الـERP يفضل في مكان واحد.
	mux.HandleFunc("/products/file", guard(handleProductsFile))
	mux.HandleFunc("/products/file/raw", guard(handleProductsFileRaw))
	// 📶 النظام بيقول إن الرفع ماشي — الشرح عند uploadProgress
	mux.HandleFunc("/products/file/progress", guard(handleProductsFileProgress))
	// 🗂️ شاشة "اختار ملف" بتاعة الويندوز — المتصفح مايقدرش يدّي مسار
	mux.HandleFunc("/products/file/pick", guard(handleProductsFilePick))
	// ⬆️ الرفع اليدوي — الشرح عند handleProductsUploadNow
	mux.HandleFunc("/products/upload-now", guard(handleProductsUploadNow))

	// 🎨 تصميم الملصق — النظام بيقرا /design والمصمّم بيكتب عليه.
	mux.HandleFunc("/design", guard(handleDesign))
	mux.HandleFunc("/design/all", guard(handleDesignAll))
	mux.HandleFunc("/design/active", guard(handleDesignActive))
	mux.HandleFunc("/design/delete", guard(handleDesignDelete))
	// ✏️ تغيير اسم تصميم — الشرح عند renameDesign في design.go
	mux.HandleFunc("/design/rename", guard(handleDesignRename))
	// 🎭 أنهي تصميم لأنهي نوع ملصق (عادي / مقسوم ٤ / من غير سعر)
	mux.HandleFunc("/design/for", guard(handleDesignFor))
	mux.HandleFunc("/design/role", guard(handleDesignRole))
	mux.HandleFunc("/designer", guard(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(designerPage))
	}))
	// ⚠️ مولّد الـQR بيتقدّم من هنا مش من الإنترنت: المصمّم لازم يشتغل
	// والمحل من غير نت — ده سبب وجود البرنامج المساعد أصلًا.
	// 🔤 خطوط الملصق — محفورة جوّه البرنامج (شوف fonts.go)
	mux.HandleFunc("/fonts.css", guard(handleFontsCSS))
	mux.HandleFunc("/fonts.json", guard(handleFontsJSON))
	mux.HandleFunc("/fonts/", guard(handleFontFile))
	mux.HandleFunc("/qrcode.js", guard(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.Write([]byte(qrcodeLibJS))
	}))
	mux.HandleFunc("/settings", guard(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
			return
		}
		// ============================================================
		// ⚠️⚠️⚠️ بنبدأ من **المحفوظ** مش من كائن فاضي — عطل حقيقي
		// ============================================================
		// الحفظ هنا بيستبدل الملف كله بالكائن اللي جاي، والصفحة
		// بتبعت الحقول اللي فيها بس (الطابعتين والاسم والمعايرة).
		//
		// فأول ما اتخزّنت حاجات تانية في نفس الملف — **التصاميم**
		// واختيار كل نوع ملصق — بقت كل دوسة على "احفظ الإعدادات"
		// بتمسحها كلها في سكوت. تظبط تصميمك بالمليمتر، تروح تغيّر
		// اسم الجهاز، يرجع الافتراضي.
		//
		// وكان فيه سطر واحد بيعالج نفس الحاجة لمعرّف الماكينة
		// (`if in.MachineID == ""`) — علاج لحالة واحدة بدل القاعدة،
		// فأول ما اتضاف حقل جديد وقع في نفس الحفرة.
		//
		// القاعدة الصح: ابدأ من اللي محفوظ، والـJSON يكتب فوق اللي
		// بعته بس. كل حقل جديد بقى محمي تلقائيًا من غير ما حد يفتكر.
		in := getSettings()
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "الطلب مش مفهوم"})
			return
		}
		if in.MachineID == "" {
			in.MachineID = machineID()
		}
		if err := saveSettings(in); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}))
	// ============================================================
	// 📦 نقل الإعدادات لجهاز تاني
	// ============================================================
	// ⚠️ الفايدة: تظبط كمبيوتر واحد (التصاميم، المقاسات، المعايرة)
	// وتنقله للباقيين بملف بدل ما تعيد الشغل على كل جهاز.
	mux.HandleFunc("/settings/export", guard(func(w http.ResponseWriter, r *http.Request) {
		s := getSettings()
		// ⚠️⚠️ معرّف الماكينة **مايتصدّرش**: هو هوية الكمبيوتر ده
		// بالذات. لو اتنقل، الجهازين هيبقوا جهاز واحد في النظام —
		// وده بالظبط العطل اللي المعرّف اتعمل عشان يمنعه.
		s.MachineID = ""
		// ⚠️ واسم الجهاز كمان: "كمبيوتر الكاشير" على جهازين = لخبطة.
		s.DeviceName = ""
		b, err := json.MarshalIndent(s, "", "  ")
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Disposition", `attachment; filename="tazweed-settings.json"`)
		w.Write(b)
	}))
	mux.HandleFunc("/settings/import", guard(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"ok": false, "error": "POST بس"})
			return
		}
		// ⚠️ بنبدأ من المحفوظ زي /settings بالظبط: الملف المستورد
		// ممكن يكون من نسخة أقدم وناقص حقول، ومايصحّش يمسحها.
		in := getSettings()
		keepID, keepName := in.MachineID, in.DeviceName
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": "الملف مش مفهوم"})
			return
		}
		// ⚠️⚠️ الهوية بتفضل **بتاعة الجهاز ده** مهما كان في الملف.
		in.MachineID, in.DeviceName = keepID, keepName
		if in.MachineID == "" {
			in.MachineID = machineID()
		}
		if err := saveSettings(in); err != nil {
			writeJSON(w, http.StatusOK, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "designs": len(in.Designs)})
	}))
	mux.HandleFunc("/autostart", guard(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
			return
		}
		var in struct {
			On bool `json:"on"`
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "الطلب مش مفهوم"})
			return
		}
		if err := setAutostart(in.On); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true, "on": autostartEnabled()})
	}))
	mux.HandleFunc("/update/check", guard(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, checkUpdate())
	}))
	// ⚠️ التحديث **POST** مش GET عن قصد: حاجة بتغيّر البرنامج نفسه
	// مايصحّش تتنفّذ بمجرد فتح رابط.
	mux.HandleFunc("/update/apply", guard(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
			return
		}
		// ⚠️ إعادة التركيب بالإجبار — للنسخة اللي على الجهاز لو بايظة.
		// الافتراضي **لأ**: الشرح عند applyUpdate.
		force := r.URL.Query().Get("force") == "1"
		updated, err := applyUpdate(force)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "updated": updated, "version": version})
		// ⚠️⚠️ مافيش إعادة تشغيل لو مافيش تحديث: قفل البرنامج
		// وفتحه من غير أي سبب هو نفسه العطل اللي اتبلّغ.
		if !updated {
			return
		}
		// ⚠️ الرد بيتبعت **قبل** إعادة التشغيل: لو قفلنا الأول،
		// الصفحة مش هتعرف إن التحديث نجح.
		go func() {
			time.Sleep(600 * time.Millisecond)
			restartSelf()
			os.Exit(0)
		}()
	}))
	return mux
}

func main() {
	// ⚠️ أول سطر خالص: قبل أي طباعة على الشباك، وإلا أول الرسائل
	// بيطلع مربعات.
	fixConsoleEncoding()
	loadSettings()
	// ⚠️⚠️ **قبل** التنضيف: cleanupOldBinary بتمسح الدليل اللي
	// startedByUpdate بتقرا منه. الشرح الكامل عند startedByUpdate.
	updatedSilently := startedByUpdate()
	// نضّف نسخة قديمة فاضلة من تحديث سابق
	cleanupOldBinary()
	mux := newServer()
	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		// ⚠️ الورقة الكبيرة محتاجة وقت تتبعت، فالمهلة واسعة —
		// بس مش لا نهائية عشان اتصال معلّق مايقفلش البرنامج.
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Println("❌ مش قادر أفتح على", addr)
		fmt.Println("   يمكن فيه نسخة تانية من البرنامج شغّالة خلاص.")
		fmt.Println("   التفاصيل:", err)
		fmt.Println("\nاضغط Enter للخروج...")
		fmt.Scanln()
		os.Exit(1)
	}
	fmt.Println("🖨️  مساعد التزويد — نسخة", version)
	fmt.Println("✅ شغّال على http://" + addr)
	fmt.Println("   سيبه مفتوح والنظام هيلاقيه لوحده.")
	fmt.Println("   للإيقاف: من الأيقونة اللي جنب الساعة.")
	// ⚠️ الفتح **بعد** ما الاستماع يبدأ فعلًا (net.Listen فوق نجحت)،
	// وإلا المتصفح بيفتح على صفحة فاضية قبل ما الخادم يجهز.
	// ⚠️ لما الويندوز يشغّله مع البداية، بيبعت `--startup` — وساعتها
	// **مايفتحش المتصفح**. من غير كده كل مرة تفتح الكمبيوتر هتلاقي
	// صفحة فاتحة في وشك، وده اللي اتطلب إنه مايحصلش.
	silent := false
	// ⚠️⚠️ بعد تحديث = **مافيش أي نافذة خالص**. اتطلب بالنص:
	// "ميفتحش الواجهة بعد ما البرنامج المساعد يتحدث يعني يتحدث في صمت
	//  في الخلفيه".
	//
	// ⚠️ وهي غير `--startup`: دي بتفتح **النظام** لو المفتاح مفتوح.
	// بعد التحديث مافيش حاجة تتفتح أصلًا — اللي دوس تحديث من تليفونه
	// مش عايز يفتح حاجة على كمبيوتر هو مش قدامه.
	// ⚠️ بيتحدد من حتّتين: العلم اللي النسخة الجديدة بتتشغّل بيه
	// (شغّال من التحديثة الجاية)، والاكتشاف الذاتي (شغّال دلوقتي حتى
	// لو اللي حدّثنا نسخة قديمة). أي واحدة فيهم كفاية.
	afterUpdate := updatedSilently
	for _, a := range os.Args[1:] {
		switch a {
		case "--startup", "-startup":
			silent = true
		case updatedFlag, "-updated":
			silent, afterUpdate = true, true
		}
	}
	if afterUpdate {
		// مافيش أي فتح — لا صفحة البرنامج ولا النظام.
	} else if !silent {
		openBrowser("http://" + addr)
	} else if getSettings().OpenSystemOnStart {
		// ============================================================
		// 🚀 يفتح النظام لوحده مع الويندوز
		// ============================================================
		// ⚠️ **النظام** مش صفحة البرنامج: اللي بيفتح الكمبيوتر الصبح
		// عايز يشتغل على طول، مش يلاقي صفحة إعدادات.
		//
		// ⚠️⚠️ ومقفول افتراضيًا: فتح نافذة في وش المستخدم من غير ما
		// يطلب حاجة مزعج، وده بالظبط اللي `--startup` اتعملت عشان
		// تمنعه. الفرق إنه دلوقتي **باختياره**.
		openBrowser(systemURL)
	}
	log.SetFlags(log.Ltime)

	// ⚠️ الخادم في خيط لوحده، والأيقونة بتمسك الخيط الرئيسي: مكتبة
	// شريط المهام **لازم** تشتغل على الخيط الرئيسي في الويندوز، وإلا
	// الأيقونة مابتظهرش خالص.
	go func() {
		if err := srv.Serve(ln); err != nil {
			log.Println("وقف:", err)
		}
	}()

	// ⚠️ الإخفاء **بعد** ما كل حاجة تشتغل: لو البورت كان مشغول،
	// الرسالة اللي فوق بتفضل باينة والمستخدم يقدر يقراها.
	hideConsoleWindow()
	startTray(func() { os.Exit(0) })
}
