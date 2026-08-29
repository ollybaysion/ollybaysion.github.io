/**
 * 파생 데이터를 만드는 순수 함수들.
 * 빌드 스크립트는 파일만 읽고 쓰고, 계산은 전부 여기서 한다.
 */
import { NEIGHBOR_LIMIT } from './constants.ts';
import { proximity, screenDistance } from './position.ts';
import type { Placement } from './position.ts';

/** 좌표가 박힌 글 하나. 파생 계산에 필요한 최소한만 본다. */
export interface PlacedEntry extends Placement {
	slug: string;
	category: string;
	/** 발행일(ISO). 시리즈 회차 추론과 정렬에 쓴다. */
	date: string;
	series?: string | undefined;
	episode?: number | undefined;
}

export interface Neighbor {
	slug: string;
	/** 화면 거리(px). 정렬 기준. */
	distance: number;
	/** 화면에 띄우는 근접도 [0, 1]. 거리에서 파생된 값이다. */
	proximity: number;
}

/** 발행일 → 슬러그 순. 같은 날 글도 순서가 흔들리지 않게 슬러그로 묶는다. */
export function byDateThenSlug(a: PlacedEntry, b: PlacedEntry): number {
	const diff = Date.parse(a.date) - Date.parse(b.date);
	return diff !== 0 ? diff : a.slug.localeCompare(b.slug);
}

/**
 * 한 글의 근방 — 화면 거리순 상위 N편.
 * 거리가 같으면 슬러그로 갈라서 빌드마다 순서가 바뀌지 않게 한다.
 */
export function neighborsOf(
	target: PlacedEntry,
	all: readonly PlacedEntry[],
	limit: number = NEIGHBOR_LIMIT,
): Neighbor[] {
	return all
		.filter((entry) => entry.slug !== target.slug)
		.map((entry) => ({
			slug: entry.slug,
			distance: screenDistance(target, entry),
			proximity: proximity(target, entry),
		}))
		.sort((a, b) => a.distance - b.distance || a.slug.localeCompare(b.slug))
		.slice(0, limit);
}

/** 모든 글의 근방을 한 번에. */
export function neighborMap(
	all: readonly PlacedEntry[],
	limit: number = NEIGHBOR_LIMIT,
): Record<string, Neighbor[]> {
	const out: Record<string, Neighbor[]> = {};
	for (const entry of all) {
		out[entry.slug] = neighborsOf(entry, all, limit);
	}
	return out;
}

export interface ConstellationMember {
	slug: string;
	/** 확정된 회차. frontmatter에 episode가 없으면 날짜순으로 매긴다. */
	episode: number;
	angle: number;
	radius: number;
}

/**
 * 시리즈 별자리 — 멤버를 회차 순으로 세운다.
 * episode를 적은 글이 먼저 자리를 잡고, 안 적은 글은 남은 번호를 날짜순으로 받는다.
 * 멤버가 하나면 점 하나짜리 별자리가 된다.
 */
export function orderSeries(members: readonly PlacedEntry[]): ConstellationMember[] {
	const sorted = [...members].sort(byDateThenSlug);
	const claimed = new Map<number, PlacedEntry>();
	const unnumbered: PlacedEntry[] = [];

	for (const member of sorted) {
		// 같은 번호를 두 글이 주장하면 날짜가 이른 쪽이 가져가고, 나머지는 빈 번호로 민다.
		if (member.episode !== undefined && !claimed.has(member.episode)) {
			claimed.set(member.episode, member);
		} else {
			unnumbered.push(member);
		}
	}

	let next = 1;
	for (const member of unnumbered) {
		while (claimed.has(next)) next += 1;
		claimed.set(next, member);
	}

	return [...claimed.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([episode, member]) => ({
			slug: member.slug,
			episode,
			angle: member.angle,
			radius: member.radius,
		}));
}

/** 시리즈 이름 → 별자리. 시리즈가 없는 글은 빠진다. */
export function constellations(all: readonly PlacedEntry[]): Record<string, ConstellationMember[]> {
	const groups = new Map<string, PlacedEntry[]>();
	for (const entry of all) {
		if (!entry.series) continue;
		const members = groups.get(entry.series) ?? [];
		members.push(entry);
		groups.set(entry.series, members);
	}

	const out: Record<string, ConstellationMember[]> = {};
	for (const name of [...groups.keys()].sort()) {
		out[name] = orderSeries(groups.get(name)!);
	}
	return out;
}

/** 카테고리 → 최신순 슬러그. 목록 화면의 뼈대. */
export function groupByCategory(all: readonly PlacedEntry[]): Record<string, string[]> {
	const groups = new Map<string, PlacedEntry[]>();
	for (const entry of all) {
		const members = groups.get(entry.category) ?? [];
		members.push(entry);
		groups.set(entry.category, members);
	}

	const out: Record<string, string[]> = {};
	for (const name of [...groups.keys()].sort()) {
		out[name] = groups
			.get(name)!
			.sort((a, b) => byDateThenSlug(b, a))
			.map((entry) => entry.slug);
	}
	return out;
}
