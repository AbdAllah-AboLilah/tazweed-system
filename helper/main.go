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
	version = "1.2.0"
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
	App      string   `json:"app"`
	Version  string   `json:"version"`
	OS       string   `json:"os"`
	Printers []string `json:"printers"`
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	printers, err := listPrinters()
	if err != nil {
		log.Println("تعذّرت قراءة الطابعات:", err)
		printers = []string{}
	}
	writeJSON(w, http.StatusOK, statusReply{
		App: "tazweed-helper", Version: version, OS: osName(), Printers: printers,
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
	if strings.TrimSpace(req.Printer) == "" {
		writeJSON(w, http.StatusBadRequest, printReply{Error: "مافيش اسم طابعة"})
		return
	}
	// ⚠️ بنقبل الترويسة لو جت بالغلط بدل ما نفشل بسببها
	png := req.PNG
	if i := strings.Index(png, "base64,"); i >= 0 {
		png = png[i+7:]
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(png))
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
	if err := printRaw(req.Printer, data, jobName); err != nil {
		log.Println("فشل الإرسال للطابعة:", err)
		writeJSON(w, http.StatusInternalServerError, printReply{Error: err.Error()})
		return
	}
	log.Printf("اتطبعت: %s — %dx%d نقطة، %d بايت\n", req.Printer, wpx, hpx, len(data))
	writeJSON(w, http.StatusOK, printReply{OK: true, Bytes: len(data), Width: wpx, Height: hpx})
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
	fmt.Println("   للإيقاف: اقفل الشباك ده.")
	// ⚠️ الفتح **بعد** ما الاستماع يبدأ فعلًا (net.Listen فوق نجحت)،
	// وإلا المتصفح بيفتح على صفحة فاضية قبل ما الخادم يجهز.
	openBrowser("http://" + addr)
	log.SetFlags(log.Ltime)
	if err := srv.Serve(ln); err != nil {
		log.Println("وقف:", err)
	}
}
