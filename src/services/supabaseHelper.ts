import { supabase } from '../lib/supabase';

/**
 * Performs a highly robust Supabase upsert with automatic chunk size splitting, retries,
 * and single-record data sanitization.
 * 
 * If an upsert request fails (e.g., due to "TypeError: Failed to fetch", payload size limits,
 * network disconnections, or database timeouts), the chunk is automatically split in half and
 * retried recursively.
 * 
 * If a single record still fails, its optional heavy fields are stripped/truncated to fit under
 * payload size limits. If it still fails, it is skipped so that the rest of the batch can succeed.
 */
export const safeSupabaseUpsert = async (
  tableName: string,
  records: any[],
  onConflict: string = 'id',
  alreadySanitized: boolean = false,
  depth: number = 0
): Promise<{ success: boolean; succeededCount: number; failedCount: number }> => {
  if (!records || records.length === 0) {
    return { success: true, succeededCount: 0, failedCount: 0 };
  }

  try {
    const { error } = await supabase
      .from(tableName)
      .upsert(records, { onConflict });

    if (error) {
      if (error.message && error.message.includes('row-level security policy')) {
        console.warn(`[Safe Upsert] Supabase RLS access denied for ${tableName}.`);
        return { success: false, succeededCount: 0, failedCount: records.length };
      }
      throw error;
    }

    return { success: true, succeededCount: records.length, failedCount: 0 };
  } catch (err: any) {
    const errMessage = err?.message || String(err);
    console.warn(
      `[Safe Upsert] Upsert failed on table "${tableName}" for chunk of size ${records.length} at depth ${depth}:`,
      errMessage
    );

    // If chunk contains multiple records, split and retry each half recursively
    if (records.length > 1) {
      const mid = Math.floor(records.length / 2);
      const firstHalf = records.slice(0, mid);
      const secondHalf = records.slice(mid);

      console.info(
        `[Safe Upsert] Splitting failed chunk of size ${records.length} into two halves (${firstHalf.length} and ${secondHalf.length}) for "${tableName}"...`
      );

      const res1 = await safeSupabaseUpsert(tableName, firstHalf, onConflict, alreadySanitized, depth + 1);
      const res2 = await safeSupabaseUpsert(tableName, secondHalf, onConflict, alreadySanitized, depth + 1);

      return {
        success: res1.success && res2.success,
        succeededCount: res1.succeededCount + res2.succeededCount,
        failedCount: res1.failedCount + res2.failedCount,
      };
    } else {
      // We are down to a single record. Attempt healing or skip.
      const singleRecord = records[0];

      if (!alreadySanitized && singleRecord.data && typeof singleRecord.data === 'object') {
        console.info(`[Safe Upsert] Attempting to sanitize single failing record ID "${singleRecord.id}" in "${tableName}"...`);
        
        const originalData = singleRecord.data;
        const sanitizedData = { ...originalData };

        // Strip or heavily truncate large analysis logs / algorithms report if present
        if (typeof sanitizedData.algoReport === 'string' && sanitizedData.algoReport.length > 5000) {
          sanitizedData.algoReport = sanitizedData.algoReport.substring(0, 1000) + '... [Truncated for payload limits]';
        }
        if (typeof sanitizedData.analysis === 'string' && sanitizedData.analysis.length > 5000) {
          sanitizedData.analysis = sanitizedData.analysis.substring(0, 1000) + '... [Truncated for payload limits]';
        }
        if (typeof sanitizedData.rawPrediction === 'string' && sanitizedData.rawPrediction.length > 5000) {
          sanitizedData.rawPrediction = sanitizedData.rawPrediction.substring(0, 1000) + '... [Truncated for payload limits]';
        }
        
        // Remove massive optional arrays if any
        if (Array.isArray(sanitizedData.patterns)) {
          sanitizedData.patterns = undefined;
        }

        const sanitizedRecord = {
          ...singleRecord,
          data: sanitizedData
        };

        // Retry once with the sanitized record
        const retryResult = await safeSupabaseUpsert(tableName, [sanitizedRecord], onConflict, true, depth + 1);
        if (retryResult.success) {
          console.log(`[Safe Upsert] Successfully saved sanitized record ID "${singleRecord.id}".`);
          return retryResult;
        }
      }

      // If already sanitized or doesn't have object data, skip to protect the transaction pipeline
      console.error(
        `[Safe Upsert] CRITICAL: Skipping unsaveable record ID "${singleRecord.id}" in "${tableName}" to prevent pipeline blockage.`
      );
      return { success: false, succeededCount: 0, failedCount: 1 };
    }
  }
};
