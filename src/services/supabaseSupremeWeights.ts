import { supabase } from '../lib/supabase';

export interface SupremeDbWeight {
  category: string;
  feature_name: string;
  goal_accuracy: number;
  overall_accuracy: number;
  updated_at?: string;
}

/**
 * Saves supreme custom weights directly to the supreme_custom_weights Supabase table.
 */
export const saveSupremeWeightsToDb = async (weightsMap: Record<string, any>): Promise<boolean> => {
  try {
    const rows: SupremeDbWeight[] = [];
    Object.keys(weightsMap).forEach(cat => {
      Object.keys(weightsMap[cat]).forEach(feat => {
        const item = weightsMap[cat][feat];
        if (item && typeof item.goalAccuracy === 'number') {
          rows.push({
            category: cat,
            feature_name: feat,
            goal_accuracy: item.goalAccuracy,
            overall_accuracy: item.overallAccuracy || 50,
            updated_at: new Date().toISOString()
          });
        }
      });
    });

    if (rows.length === 0) return true;

    // Split rows into chunks of 100 to prevent query size limit issues
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('supreme_custom_weights')
        .upsert(chunk, { onConflict: 'category,feature_name' });

      if (error) {
        console.warn("Failed to upsert supreme_custom_weights into Supabase:", error);
        return false;
      }
    }

    console.log(`Successfully synced ${rows.length} custom weights to supreme_custom_weights table.`);
    return true;
  } catch (err) {
    console.error("Error saving supreme weights to DB:", err);
    return false;
  }
};

/**
 * Loads custom weights directly from the supreme_custom_weights Supabase table.
 */
export const loadSupremeWeightsFromDb = async (): Promise<Record<string, Record<string, { goalAccuracy: number; overallAccuracy: number }>>> => {
  try {
    const { data, error } = await supabase
      .from('supreme_custom_weights')
      .select('category, feature_name, goal_accuracy, overall_accuracy');

    if (error) {
      console.warn("Failed to fetch supreme_custom_weights from Supabase (table might need migration):", error);
      return {};
    }

    const customWeights: Record<string, Record<string, { goalAccuracy: number; overallAccuracy: number }>> = {};
    if (data) {
      data.forEach(row => {
        const cat = row.category;
        const feat = row.feature_name;
        if (!customWeights[cat]) {
          customWeights[cat] = {};
        }
        customWeights[cat][feat] = {
          goalAccuracy: Number(row.goal_accuracy),
          overallAccuracy: Number(row.overall_accuracy)
        };
      });
    }

    return customWeights;
  } catch (err) {
    console.error("Error loading supreme weights from DB:", err);
    return {};
  }
};
