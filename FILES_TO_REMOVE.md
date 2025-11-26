# Files to Remove - Cleanup Script

## 🗑️ Unnecessary Files to Delete

### Root Directory - Temporary SQL Files:
These are one-time check/debug files that are no longer needed:
- ❌ `check_projects.sql`
- ❌ `check_storage.sql`
- ❌ `check_tables.sql`
- ❌ `supabase_schema.sql`
- ❌ `temp_migration.sql`

### Root Directory - Documentation (Keep or Remove?):
These are documentation files I created. You can keep the useful ones:
- ✅ `README.md` - **KEEP** (main project documentation)
- ⚠️ `CHAT_LOCATIONS_MAP.md` - Reference for chat locations (useful)
- ⚠️ `DEPLOY_MESSAGE_NOTIFICATIONS.md` - Deployment guide (useful once, then can delete)
- ⚠️ `MESSAGE_NOTIFICATIONS_STATUS.md` - Status documentation (useful reference)
- ⚠️ `NOTIFICATION_SEPARATION.md` - Implementation details (useful reference)
- ⚠️ `PRIVATE_DISCUSSION_ROOMS_IMPLEMENTATION.md` - Feature documentation (useful reference)
- ⚠️ `PRIVATE_PROJECTS_IMPLEMENTATION.md` - Feature documentation (useful reference)
- ❌ `FIXING_TYPES.md` - Temporary fix documentation (can delete after types are fixed)

### Migrations Directory - Duplicates/Old:
- ⚠️ `00000000000000_combined_all_migrations.sql` - Combined migration (may be useful for reference)
- ⚠️ `20251206000008_rename_comments.sql` - Superseded by v2 (can delete if v2 works)

## 🧹 Recommended Cleanup

### Safe to Delete Immediately:
```
check_projects.sql
check_storage.sql
check_tables.sql
supabase_schema.sql
temp_migration.sql
FIXING_TYPES.md
```

### Consider Keeping (Useful Documentation):
```
CHAT_LOCATIONS_MAP.md
MESSAGE_NOTIFICATIONS_STATUS.md
NOTIFICATION_SEPARATION.md
PRIVATE_DISCUSSION_ROOMS_IMPLEMENTATION.md
PRIVATE_PROJECTS_IMPLEMENTATION.md
```

### Delete After Deployment:
```
DEPLOY_MESSAGE_NOTIFICATIONS.md (after you deploy)
```

## 📝 PowerShell Command to Delete

Run this to delete the temporary SQL files:

```powershell
Remove-Item "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect\check_projects.sql"
Remove-Item "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect\check_storage.sql"
Remove-Item "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect\check_tables.sql"
Remove-Item "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect\supabase_schema.sql"
Remove-Item "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect\temp_migration.sql"
Remove-Item "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect\FIXING_TYPES.md"
```

Or delete all at once:
```powershell
$filesToDelete = @(
    "check_projects.sql",
    "check_storage.sql",
    "check_tables.sql",
    "supabase_schema.sql",
    "temp_migration.sql",
    "FIXING_TYPES.md"
)

$basePath = "c:\Users\Varun Kumar\.gemini\antigravity\scratch\reelsphere\reel-sphere-connect"

foreach ($file in $filesToDelete) {
    $fullPath = Join-Path $basePath $file
    if (Test-Path $fullPath) {
        Remove-Item $fullPath -Force
        Write-Host "Deleted: $file" -ForegroundColor Green
    }
}
```

## 📊 Summary

**Total Files to Delete:** 6 temporary/debug files
**Documentation Files:** Keep the useful ones, delete after deployment if needed
**Migration Files:** Keep all in migrations folder (they're version controlled)

Would you like me to delete these files for you?
