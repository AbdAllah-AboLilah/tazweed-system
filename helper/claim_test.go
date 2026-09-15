package main

import "testing"

// ⚠️ الحجز هو اللي بيمنع نافذتين على نفس الكمبيوتر إنهم ينفّذوا نفس
// الطلب. الشرح الكامل في claim.go.
func TestClaimJobOnlyFirstWins(t *testing.T) {
	if !claimJob("job-1") {
		t.Fatal("أول حجز لازم يكسب")
	}
	if claimJob("job-1") {
		t.Fatal("⭐ التاني لازم يخسر — ده اللي بيمنع الطبعة المكررة ونافذة المعاينة")
	}
	if claimJob("job-1") {
		t.Fatal("والتالت كمان")
	}
	// وطلب تاني مالوش علاقة بيكسب عادي
	if !claimJob("job-2") {
		t.Fatal("طلب تاني لازم يكسب")
	}
}
