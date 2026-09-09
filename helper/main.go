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
	version = "1.5.0"
	addr    = "127.0.0.1:7770"
	// 12 ميجا: ورقة التزويد كصورة أبيض وأسود بتطلع كام عشرة كيلو،
	// فده سقف واسع جدًا وبرضه بيمنع الاستهلاك.
	maxBody = 12 << 20
)

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
		RestockPrinter: cur.RestockPrinter, LabelPrinter: cur.LabelPrinter,
		Autostart:      autostartEnabled(),
		LabelGapMm:     gapMm,
		LabelDirection: direction,
		LabelFlip:      flip,
	})
}

type printRequest struct {
	Printer string `json:"printer"`
	PNG     string `json:"png"`  // base64، من غير ترويسة data:
	Cut     *bool  `json:"cut"`  // فاضي = يقص
	Name    string `json:"name"` // اسم أمر الطباعة في طابور الويندوز
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
	if err := printRaw(printer, data, jobName); err != nil {
		log.Println("فشل الإرسال للطابعة:", err)
		writeJSON(w, http.StatusInternalServerError, printReply{Error: err.Error()})
		return
	}
	log.Printf("اتطبعت: %s — %dx%d نقطة، %d بايت\n", printer, wpx, hpx, len(data))
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

	jobName := req.Name
	if jobName == "" {
		jobName = "ملصقات"
	}
	if err := printRaw(printer, data, jobName); err != nil {
		log.Println("فشل إرسال الملصقات للطابعة:", err)
		writeJSON(w, http.StatusInternalServerError, labelReply{Error: err.Error()})
		return
	}
	log.Printf("اتطبعت ملصقات: %s — %d لاصقة، %dx%d نقطة، %d بايت\n", printer, total, wpx, hpx, len(data))
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
	mux.HandleFunc("/settings", guard(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
			return
		}
		var in settings
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "الطلب مش مفهوم"})
			return
		}
		if err := saveSettings(in); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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
		if err := applyUpdate(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
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
	for _, a := range os.Args[1:] {
		if a == "--startup" || a == "-startup" {
			silent = true
		}
	}
	if !silent {
		openBrowser("http://" + addr)
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
