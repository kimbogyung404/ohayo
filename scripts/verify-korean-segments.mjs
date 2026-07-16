// backfill-korean-segments.mjs가 저장한 결과를 독립적으로 재검증한다(스크립트 자체의
// 내부 판정과는 별개로, DB에 실제로 뭐가 들어갔는지 다시 조회해서 확인).
// 실행: node scripts/verify-korean-segments.mjs [--date=2026-07-13]

import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const DATE_FILTER = args.date ?? null;
const TARGET_DATES = DATE_FILTER ? [DATE_FILTER] : ['2026-07-11', '2026-07-13'];

async function get(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function reconstruct(segments) {
  return segments.map((s) => (s.type === 'text' ? s.text : s.koreanText)).join('');
}

async function main() {
  const summary = { total: 0, filled: 0, notFilled: [], issues: [] };

  for (const date of TARGET_DATES) {
    const fortunes = await get(
      `fortunes?select=id,zodiac_id,rank,korean_translation,korean_segments,lucky_item_ko,lucky_item_ko_segments&date=eq.${date}&order=rank.asc`
    );

    for (const f of fortunes) {
      summary.total += 1;
      const label = `${date} ${f.zodiac_id}(#${f.rank})`;

      if (f.korean_segments === null || f.lucky_item_ko === null || f.lucky_item_ko_segments === null) {
        summary.notFilled.push(label);
        continue;
      }
      summary.filled += 1;

      const vocab = await get(`vocabulary?select=id,surface_form,meaning&fortune_id=eq.${f.id}`);
      const vocabIds = new Set(vocab.map((v) => v.id));

      // 1) 결합 결과 == 원문
      const koreanJoin = reconstruct(f.korean_segments);
      if (koreanJoin !== f.korean_translation) {
        summary.issues.push({ label, issue: 'korean_segments join != korean_translation' });
      }
      const luckyJoin = reconstruct(f.lucky_item_ko_segments);
      if (luckyJoin !== f.lucky_item_ko) {
        summary.issues.push({ label, issue: 'lucky_item_ko_segments join != lucky_item_ko' });
      }

      // 2) 빈 세그먼트 검사
      const allSegments = [...f.korean_segments, ...f.lucky_item_ko_segments];
      for (const s of allSegments) {
        if (s.type === 'text' && s.text === '') {
          summary.issues.push({ label, issue: 'empty text segment found' });
        }
        if (s.type === 'vocabulary' && (!s.koreanText || s.koreanText === '')) {
          summary.issues.push({ label, issue: `empty koreanText for vocabularyId ${s.vocabularyId}` });
        }
      }

      // 3) vocabularyId가 실제 vocabulary와 일치하는지
      const referencedIds = allSegments.filter((s) => s.type === 'vocabulary').map((s) => s.vocabularyId);
      for (const id of referencedIds) {
        if (!vocabIds.has(id)) {
          summary.issues.push({ label, issue: `segment references unknown vocabularyId ${id}` });
        }
      }

      // 4) 같은 vocabularyId가 같은 텍스트 안에서 두 번 이상 연결(중복 연결) 검사
      const koreanIds = f.korean_segments.filter((s) => s.type === 'vocabulary').map((s) => s.vocabularyId);
      const luckyIds = f.lucky_item_ko_segments.filter((s) => s.type === 'vocabulary').map((s) => s.vocabularyId);
      if (new Set(koreanIds).size !== koreanIds.length) {
        summary.issues.push({ label, issue: 'duplicate vocabularyId within korean_segments' });
      }
      if (new Set(luckyIds).size !== luckyIds.length) {
        summary.issues.push({ label, issue: 'duplicate vocabularyId within lucky_item_ko_segments' });
      }

      // 5) 핵심 단어 3개가 두 섹션 중 최소 한 곳에 연결됐는지
      const connected = new Set([...koreanIds, ...luckyIds]);
      const missing = [...vocabIds].filter((id) => !connected.has(id));
      if (missing.length > 0) {
        summary.issues.push({ label, issue: `vocabulary not connected to any segment: ${missing.join(', ')}` });
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
