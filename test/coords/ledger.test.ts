/** 원장 파일이 계약대로 생겼는지. Phase 2 스크립트가 이 모양을 append-only로 늘려간다. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { COORDS_VERSION, RADIUS_MAX, RADIUS_MIN } from '../../src/lib/coords/constants.ts';
import type { Ledger } from '../../src/lib/coords/types.ts';

const LEDGER_PATH = fileURLToPath(new URL('../../src/data/coordinates.json', import.meta.url));
const raw = readFileSync(LEDGER_PATH, 'utf8');
const ledger = JSON.parse(raw) as Ledger;

describe('coordinates.json', () => {
	it('version · epoch · entries 세 필드를 갖는다', () => {
		assert.deepEqual(Object.keys(ledger).sort(), ['entries', 'epoch', 'version']);
	});

	it('알고리즘 버전이 엔진 상수와 일치한다', () => {
		assert.equal(ledger.version, COORDS_VERSION);
	});

	it('epoch는 ISO 날짜이거나 (글이 없으면) null이다', () => {
		if (ledger.epoch !== null) {
			assert.ok(!Number.isNaN(new Date(ledger.epoch).getTime()), `epoch 파싱 실패: ${ledger.epoch}`);
		}
	});

	it('모든 항목이 angle · radius · placedAt 을 갖고 범위 안에 있다', () => {
		for (const [slug, entry] of Object.entries(ledger.entries)) {
			assert.ok(entry.angle >= 0 && entry.angle < 360, `${slug} angle ${entry.angle}`);
			assert.ok(entry.radius >= RADIUS_MIN && entry.radius <= RADIUS_MAX, `${slug} radius ${entry.radius}`);
			assert.ok(!Number.isNaN(new Date(entry.placedAt).getTime()), `${slug} placedAt ${entry.placedAt}`);
		}
	});

	it('사람이 읽고 커밋하는 파일이라 2칸 들여쓰기 + 개행으로 끝난다', () => {
		assert.equal(raw, `${JSON.stringify(ledger, null, 2)}\n`);
	});
});
