import * as dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../src/lib/supabase';
import { getStableMatchId } from '../src/utils/matchId';

function normalizeTeams(teamsStr: string): string {
  if (!teamsStr) return '';
  return teamsStr
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseDateToTime(dateStr: string | undefined | null): number {
  if (!dateStr) return 0;
  let str = dateStr.trim();
  if (str.includes('T')) {
    str = str.split('T')[0];
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(str)) {
    const parts = str.split(/[-/]/);
    if (parts.length >= 3) {
      str = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  const t = new Date(str).getTime();
  return isNaN(t) ? 0 : t;
}

function getStatsKey(m: any): string {
  if (!m) return '';
  const mo = (m.mo || '').trim();
  const ga = (m.ga || '').trim();
  const gs = (m.gs || '').trim();
  const l10 = (m.l10 || '').trim();
  const le = (m.le || '').trim();
  return `${mo}|${ga}|${gs}|${l10}|${le}`;
}

export async function runDeleteDuplicates() {
  console.log("=== STARTING COMPLETE DUPLICATE MATCHES DELETION ===");

  const tables = [
    'user_uploaded_matches',
    'precalculated_matches',
    'group_1_matches',
    'group_2_matches',
    'group_3_matches',
    'pattern_matches',
    'live_matches',
    'nerdy_matches',
    'nerdy_jackpot_matches'
  ];

  let totalDeletedOverall = 0;
  const allDeletedIdsSet = new Set<string>();
  const tableSummary: Record<string, number> = {};

  for (const table of tables) {
    console.log(`\n--- Processing table: ${table} ---`);
    let from = 0;
    const step = 1000;
    let hasMore = true;
    const metaRows: { id: string; teams: string; date: string }[] = [];

    // Step 1: Fetch metadata
    while (hasMore) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id, teams, date')
          .order('id', { ascending: true })
          .range(from, from + step - 1);

        if (error || !data) break;
        metaRows.push(...data);
        if (data.length < step) hasMore = false;
        else from += step;
      } catch { break; }
    }

    if (metaRows.length === 0) {
      tableSummary[table] = 0;
      continue;
    }

    // Step 2: Group by normalized teams
    const teamGroups = new Map<string, { id: string; teams: string; date: string }[]>();
    for (const r of metaRows) {
      const teamsKey = normalizeTeams(r.teams);
      if (!teamsKey) continue;
      if (!teamGroups.has(teamsKey)) teamGroups.set(teamsKey, []);
      teamGroups.get(teamsKey)!.push(r);
    }

    const candidateIds: string[] = [];
    for (const [teamsKey, rows] of teamGroups.entries()) {
      if (rows.length >= 2) {
        for (const r of rows) candidateIds.push(r.id);
      }
    }

    if (candidateIds.length === 0) {
      tableSummary[table] = 0;
      continue;
    }

    // Step 3: Fetch full 'data' in small batches or single eq queries
    const fullCandidateRows: any[] = [];
    const chunkSize = 50;
    for (let i = 0; i < candidateIds.length; i += chunkSize) {
      const chunkIds = candidateIds.slice(i, i + chunkSize);
      const { data: fullData } = await supabase
        .from(table)
        .select('id, teams, date, data')
        .in('id', chunkIds);

      if (fullData) {
        fullCandidateRows.push(...fullData);
      }
    }

    // Step 4: Group candidate rows by Normalized Teams + Core Stats Key
    const statsGroups = new Map<string, any[]>();
    for (const row of fullCandidateRows) {
      const m = row.data || row;
      const teams = m.teams || row.teams || '';
      const teamsKey = normalizeTeams(teams);
      if (!teamsKey) continue;

      const statsKey = getStatsKey(m);
      const groupKey = `${teamsKey}||${statsKey}`;

      if (!statsGroups.has(groupKey)) {
        statsGroups.set(groupKey, []);
      }

      const matchDateStr = m.date || row.date || '';
      statsGroups.get(groupKey)!.push({
        dbRowId: row.id,
        data: m,
        teams: teams,
        date: matchDateStr,
        timestamp: parseDateToTime(matchDateStr)
      });
    }

    // Step 5: Identify recent-date duplicates to delete
    const idsToDeleteInTable: string[] = [];

    for (const [groupKey, matches] of statsGroups.entries()) {
      if (matches.length < 2) continue; // No duplicate

      // Sort matches by date timestamp ASC (oldest date first)
      matches.sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp; // Oldest first
        }
        return 0;
      });

      const original = matches[0]; // Keep oldest date
      const duplicates = matches.slice(1); // Delete recent date copy(ies)

      for (const dup of duplicates) {
        idsToDeleteInTable.push(String(dup.dbRowId));
        allDeletedIdsSet.add(String(dup.dbRowId));

        try {
          const sid = getStableMatchId(dup.data);
          if (sid) allDeletedIdsSet.add(sid);
        } catch (e) {}
      }
    }

    console.log(`Table ${table}: Deleting ${idsToDeleteInTable.length} recent-date duplicates.`);

    // Step 6: Delete duplicate rows individually or in eq/in calls
    if (idsToDeleteInTable.length > 0) {
      for (const delId of idsToDeleteInTable) {
        const { error: delErr } = await supabase
          .from(table)
          .delete()
          .eq('id', delId);

        if (delErr) {
          console.error(`Error deleting ID "${delId}" from ${table}:`, delErr.message);
        }
      }
      totalDeletedOverall += idsToDeleteInTable.length;
      tableSummary[table] = idsToDeleteInTable.length;
    } else {
      tableSummary[table] = 0;
    }
  }

  // Step 7: Insert tombstones into deleted_match_tombstones
  if (allDeletedIdsSet.size > 0) {
    console.log(`Inserting ${allDeletedIdsSet.size} tombstones into deleted_match_tombstones...`);
    const tombstoneRows = Array.from(allDeletedIdsSet).map(id => ({ stable_id: id }));
    for (let i = 0; i < tombstoneRows.length; i += 100) {
      const chunk = tombstoneRows.slice(i, i + 100);
      await supabase
        .from('deleted_match_tombstones')
        .upsert(chunk, { onConflict: 'stable_id' });
    }
  }

  console.log(`\n=== COMPLETED DUPLICATE MATCHES DELETION ===`);
  console.log(`Total duplicate copies deleted: ${totalDeletedOverall}`);
  return { totalDeletedOverall, tableSummary };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDeleteDuplicates()
    .then((res) => {
      console.log("Result:", JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error executing script:", err);
      process.exit(1);
    });
}
