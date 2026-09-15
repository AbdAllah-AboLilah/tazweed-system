package main

// ============================================================
// 🔒 حجز طلب الطباعة — نافذة واحدة بس هي اللي تنفّذه
// ============================================================
// ⚠️⚠️ العطل اللي بيتحل، اتبلّغ بالنص: "نفس المشكلة المعاينه بتظهر" —
// وكارت الجهاز في نفس اللحظة بيقول:
//     آخر طبعة: ✅ ورقة تزويد 📦 من البرنامج المساعد
// يعني الطبعة **نجحت**، والمعاينة ظهرت برضه. فالنافذة دي مش من الطلب
// ده — دي من نافذة تانية بتنفّذ **نفس** الطلب في نفس اللحظة.
//
// --- ليه بقى بيحصل ---
// النظام بيسمع على الطلبات اللي متبعتة لرقم الجهاز بتاعه. وقبل نسخة
// 1.6.0 كل متصفح كان ليه رقم عشوائي لوحده، فنافذة واحدة بس كانت
// بتشوف الطلب.
//
// ولما المساعد بقى بيدّي **رقم واحد للماكينة** (عشان الكمبيوتر يتحسب
// جهاز واحد)، كل النوافذ على الكمبيوتر بقت بنفس الرقم — فكلها بتشوف
// نفس الطلب وكلها بتنفّذه. واحدة بتطبع من المساعد نضيف، والتانية
// بتلاقي المساعد مشغول فترجع لنافذة طباعة الويندوز.
//
// يعني توحيد الجهاز حلّ مشكلة وفتح التانية — والاتنين لازم يتحلّوا مع
// بعض.
//
// --- ليه الحجز هنا مش في السحابة ---
// الحماية اللي كانت موجودة (قايمة في ذاكرة الصفحة) بتتفضّى مع كل فتح،
// ومابتشوفش النوافذ التانية أصلًا. والسحابة كانت هتحتاج تعديل في قواعد
// الأمان.
//
// والمساعد **عملية واحدة على الماكينة**، وكل النوافذ بتكلّمه. فهو
// المكان الطبيعي الوحيد للقفل ده — ومتاح بالظبط في الحالة اللي بيحصل
// فيها العطل (لأن الأرقام مابتتوحّدش أصلًا إلا لما يكون شغّال).

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// ⚠️ الطلب بيتساب في القايمة ساعة: كفاية لأي طبعة، وقصيرة كفاية إن
// القايمة ماتكبرش. والتنضيف بيحصل مع كل حجز — مافيش مؤقّت في الخلفية.
const claimTTL = time.Hour

var (
	claimMu   sync.Mutex
	claimSeen = map[string]time.Time{}
)

// بترجّع true لو ده أول طلب حجز للرقم ده.
func claimJob(id string) bool {
	claimMu.Lock()
	defer claimMu.Unlock()

	now := time.Now()
	for k, t := range claimSeen {
		if now.Sub(t) > claimTTL {
			delete(claimSeen, k)
		}
	}
	if _, taken := claimSeen[id]; taken {
		return false
	}
	claimSeen[id] = now
	return true
}

type claimRequest struct {
	Job string `json:"job"`
}

func handleClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST بس"})
		return
	}
	var in claimRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Job == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "رقم الطلب ناقص"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true, "mine": claimJob(in.Job)})
}
