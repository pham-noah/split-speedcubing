import type { Solve } from './stats';

/** One session as the file needs it: what it is called, which puzzle it holds, and its solves. */
export interface ExportSession { name: string; event?: string; solves: Solve[] }

/** csTimer's scrType for a random-state 2x2 session. A 3x3 session writes no opt at all, which is what
 *  csTimer itself does for the standard scrambler. */
const SCR_TYPE: Record<string, string> = { '222': '222so' };

/** A time as csTimer stores it: [[penalty, ms], scramble, comment, timestamp in seconds]. The penalty is
 *  a flag on the raw time (0 ok, 2000 +2, -1 DNF) rather than a number already added in, which is exactly
 *  how Split keeps it too — nothing is rounded twice. */
function row(s: Solve): [number[], string, string, number] {
  const pen = s.pen === 'DNF' ? -1 : s.pen === '+2' ? 2000 : 0;
  const ms = Math.max(0, Math.round(s.ms));
  return [[pen, ms], s.scramble ?? '', '', Math.round((s.ts || 0) / 1000)];
}

/**
 * A csTimer export file, written the way cstimer.net writes one: `sessionN` keys numbered from 1, each an
 * array of solve rows, plus a `properties` block whose `sessionData` names the sessions and says which
 * puzzle each holds. csTimer's importer reads `properties` first (it sets `sessionN`), so the number of
 * sessions in the file is authoritative. Empty sessions are left out: they would only add clutter.
 *
 * The shape is taken from a file cstimer.net exported (src/lib/core/fixtures/cstimer-export.json) and from
 * its storage/import code, not guessed: `stat`/`date` are caches that csTimer rebuilds, so they are not
 * written here.
 */
export function toCsTimer(sessions: ExportSession[]): string {
  const used = sessions.filter((s) => s.solves.length);
  const out: Record<string, unknown> = {};
  const data: Record<string, { name: string; opt: Record<string, string>; rank: number }> = {};
  used.forEach((s, i) => {
    const n = i + 1;
    out[`session${n}`] = s.solves.map(row);
    const scrType = SCR_TYPE[s.event ?? '333'];
    data[String(n)] = { name: s.name || `Session ${n}`, opt: scrType ? { scrType } : {}, rank: n };
  });
  out.properties = { sessionData: JSON.stringify(data), sessionN: used.length };
  return JSON.stringify(out, null, 1);
}
