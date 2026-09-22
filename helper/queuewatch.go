package main

// ============================================================
// ⏳ الطابور الواقف — الطبعة اللي "اتبعتت" وقاعدة في مكانها
// ============================================================
// اتطلب بالنص في خريطة التطوير:
//	م٢ — تنبيه الطابور الواقف: البرنامج يشوف أمر طباعة واقف في
//	     ويندوز أكتر من دقيقة ويقول.
//
// ------------------------------------------------------------
// ⚠️⚠️ المشكلة اللي بيحلها — دي **مش** حالة الطابعة
// ------------------------------------------------------------
// حالة الطابعة (printerstatus.go) بتسأل التعريف "فيه مشكلة؟" —
// وقلنا هناك إن التعريفات الرخيصة بترد صفر دايمًا، حتى والرول خلص.
//
// الطابور حاجة تانية خالص: ده **عدّاد الويندوز** للأوامر اللي لسه
// مامشيتش. وده بيشتغل حتى لو التعريف أخرس تمامًا:
//
//	الطابعة مطفية   → الأمر بيقعد في الطابور
//	الكابل مقطوع    → بيقعد
//	الويندوز اتلغبط  → بيقعد
//
// وفي كل الحالات دي النظام بيقول "اتبعت ✅" وصاحب المحل مستني ورقة
// مش جاية. الرقم ده هو اللي يقدر يقول له إنها واقفة.
//
// ------------------------------------------------------------
// ⚠️⚠️ من غير أي شغل في الخلفية
// ------------------------------------------------------------
// البرنامج مافيهوش نبضات ولا حلقات شغالة على الفاضي (مكتوب في
// main.go من أول سطر). فبنسجّل **عيّنة مع كل سؤال**: مين سأل،
// الطابور كان كام، وامتى. اللي بيسأل هو صفحة البرنامج وهي مفتوحة،
// والنظام بعد ما يطبع.
//
// الحكم: نفس العدد، أكبر من صفر، وعدّى عليه دقيقة → واقف.

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// ⚠️ دقيقة بالظبط زي ما اتطلب. أقل من كده = إنذار كداب على ورقة
// كبيرة لسه بتتنقل للماكينة.
const queueStuckAfter = 60 * time.Second

// ⚠️⚠️ ولو مرّ وقت طويل بين سؤالين، العيّنة القديمة **مابتتحسبش**:
// إحنا مانعرفش حصل إيه في النص. ورقة اتطبعت وواحدة تانية اتبعتت
// بنفس العدد بتبقى شبه الواقفة بالظبط — وإنذار كداب على ورقة سليمة
// أسوأ من سكوت.
const queueSampleMaxGap = 10 * time.Minute

type queueSample struct {
	jobs  int
	since time.Time // من امتى والعدد ثابت على القيمة دي
	at    time.Time // آخر سؤال
}

var (
	qMu   sync.Mutex
	qSeen = map[string]*queueSample{}
)

type queueState struct {
	Name      string `json:"name"`
	Jobs      int    `json:"jobs"`
	Supported bool   `json:"supported"`
	Stuck     bool   `json:"stuck"`
	// ⚠️ بالثواني عشان الصفحة تقول "واقف من ٣ دقايق" مش "واقف" وبس.
	// الرقم هو اللي بيفرّق بين "استنى شوية" و"روح شوف الطابعة".
	StuckSeconds int    `json:"stuckSeconds,omitempty"`
	Summary      string `json:"summary"`
	Error        string `json:"error,omitempty"`
}

// الحكم لوحده — بياخد العدد والوقت، عشان يتفحص من غير ويندوز.
func queueJudge(name string, jobs int, supported bool, errMsg string, now time.Time) queueState {
	st := queueState{Name: name, Jobs: jobs, Supported: supported, Error: errMsg}
	if !supported || errMsg != "" {
		qMu.Lock()
		delete(qSeen, name)
		qMu.Unlock()
		st.Summary = "الجهاز ده مايقدرش يقرا الطابور"
		if errMsg != "" {
			st.Summary = "مش قادر أقرا الطابور: " + errMsg
		}
		return st
	}

	qMu.Lock()
	prev := qSeen[name]
	switch {
	case jobs <= 0:
		// الطابور فاضي — مافيش حاجة نراقبها.
		delete(qSeen, name)
	case prev == nil || prev.jobs != jobs || now.Sub(prev.at) > queueSampleMaxGap:
		qSeen[name] = &queueSample{jobs: jobs, since: now, at: now}
	default:
		prev.at = now
		if now.Sub(prev.since) >= queueStuckAfter {
			st.Stuck = true
			st.StuckSeconds = int(now.Sub(prev.since) / time.Second)
		}
	}
	qMu.Unlock()

	switch {
	case st.Stuck:
		st.Summary = "⚠️ فيه " + itoa(int64(jobs)) + " أمر طباعة واقف في الويندوز من " + arabicSince(st.StuckSeconds)
	case jobs > 0:
		st.Summary = itoa(int64(jobs)) + " أمر في الطابور — لسه ماشي"
	default:
		st.Summary = "الطابور فاضي"
	}
	return st
}

// ⚠️ بالعربي ومقرّب: "من ٣ دقايق" أوضح بكتير من "من 187 ثانية".
func arabicSince(sec int) string {
	if sec < 120 {
		return "دقيقة"
	}
	mins := sec / 60
	if mins < 60 {
		return itoa(int64(mins)) + " دقيقة"
	}
	h := mins / 60
	if h == 1 {
		return "ساعة"
	}
	return itoa(int64(h)) + " ساعة"
}

func queueCheck(name string) queueState {
	st := readPrinterState(name)
	return queueJudge(name, st.Jobs, st.Supported, st.Error, time.Now())
}

// GET /printer/queue?name=...   (فاضي = طابعة ورقة التزويد المحفوظة)
//
// ⚠️ الافتراضي هنا **ورقة التزويد** مش الملصق — عكس /printer/status.
// السبب: اللي بيقف في الطابور ويتنسى هو ورق التزويد (ورقة واحدة
// كبيرة)، والملصقات بتتطبع قدامك وانت واقف.
func handlePrinterQueue(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	if name == "" {
		name = pickPrinter("", "restock")
	}
	if name == "" {
		writeJSON(w, http.StatusOK, queueState{Error: "مافيش طابعة متظبطة", Summary: "مافيش طابعة متظبطة"})
		return
	}
	writeJSON(w, http.StatusOK, queueCheck(name))
}
