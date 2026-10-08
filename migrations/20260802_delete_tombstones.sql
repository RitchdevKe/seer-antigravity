-- Permanently delete matches marked as tombstones from all match tables
-- This cleans up local/cloud bloat and ensures embedded_matches.json is accurate

DELETE FROM precalculated_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);

DELETE FROM user_uploaded_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);

DELETE FROM live_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);

DELETE FROM group_1_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);

DELETE FROM group_2_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);

DELETE FROM group_3_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);

DELETE FROM pattern_matches 
WHERE id IN (SELECT stable_id FROM deleted_match_tombstones);
