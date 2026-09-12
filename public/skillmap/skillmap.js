/* 스킬 카드 지도 — 카드 찾기. 본문 .md에 JS를 직접 넣지 않는다(plainText()가 임베딩에 넣는다). */
(function () {
	var root = document.querySelector('.skillmap');
	if (!root) return;
	var q = root.querySelector('#skillmap-q');
	var count = root.querySelector('#skillmap-count');
	if (!q || !count) return;
	var cards = Array.prototype.slice.call(root.querySelectorAll('.kard'));
	var secs = Array.prototype.slice.call(root.querySelectorAll('section')).filter(function (s) {
		return s.querySelector('.kard');
	});
	var total = cards.length;
	function norm(s) {
		return (s || '').toLowerCase();
	}
	function apply() {
		var t = norm(q.value).trim();
		var shown = 0;
		cards.forEach(function (c) {
			var hay = norm(c.textContent) + ' ' + norm(c.getAttribute('data-t'));
			var ok =
				!t ||
				t.split(/\s+/).every(function (w) {
					return hay.indexOf(w) > -1;
				});
			c.classList.toggle('hide', !ok);
			if (ok) shown++;
		});
		secs.forEach(function (s) {
			var any = s.querySelector('.kard:not(.hide)');
			s.classList.toggle('hide', !!t && !any);
		});
		count.textContent = t ? shown + ' / ' + total + '장' : total + '장';
	}
	q.addEventListener('input', apply);
	apply();
})();
