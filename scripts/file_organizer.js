const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();

const REQUESTED_MOVES = {
    'docs/recovery': [
        'ADMIN_RECOVERY_COMPLETE_SUMMARY.md',
        'ADMIN_RECOVERY_GUIDE.md',
        'ADMIN_RECOVERY_QUICK_START.md',
        'RECOVERY_PROCEDURE_TEST_RESULTS.md',
        'IMMEDIATE_ACTIONS_COMPLETE.md',
        'CRITICAL_FIXES_COMPLETED.md',
        'CRITICAL_ISSUES_RESOLUTION_SUMMARY.md',
        'SECURITY_UPDATE.md'
    ],
    'docs/security': [
        'COMPANY_SECURITY_ADMIN_DOCUMENTATION.md',
        'ENV_SECURITY_GUIDE.md',
        'update_env_instructions.txt'
    ],
    'docs/cloud_infrastructure': [
        'GOOGLE_CLOUD_ERROR_MONITORING.md',
        'GOOGLE_CLOUD_ERROR_MONITORING_COMPLETE.md',
        'GOOGLE_CLOUD_ERROR_MONITORING_SETUP.md',
        'GOOGLE_CLOUD_SETUP_QUICK_START.md',
        'ERROR_MONITORING_SUMMARY.md',
        'WHERE_TO_VIEW_ERRORS.md',
        'COST_OPTIMIZATION_GUIDE.md'
    ],
    'docs/testing': [
        'LOCAL_TESTING_GUIDE.md',
        'BROWSER_CONSOLE_TEST.md',
        'QUICK_SETUP_RESULTS.md'
    ],
    'docs/reports': [
        'UI_UX_DESIGN_ANALYSIS_AND_RECOMMENDATIONS.md',
        'UI_UX_IMPLEMENTATION_STATUS.md',
        'NOTIFICATION_UX_OPTIMIZATION.md',
        'AUDIT_REPORT.md',
        'OPTIMIZATION_SUMMARY.md',
        'SCALABILITY_RELIABILITY_RECOMMENDATIONS.md',
        'FINAL_REVIEW_AND_NEXT_STEPS.md',
        'FILE_REFERENCE.md',
        'CODEBASE_SUMMARY.md'
    ],
    'scripts/maintenance': [
        'cleanup-users.js',
        'create-admin.js',
        'create-backup-admin.js',
        'create-first-admin.js',
        'test-error-logging.js'
    ],
    'config/firestore_backups': [
        'firestore-admin-fix.rules',
        'firestore-debug-simple.rules',
        'firestore-debug.rules',
        'firestore-final.rules',
        'firestore-fix.rules',
        'firestore-simple.rules'
    ]
};

console.log('Starting cleanup in:', ROOT_DIR);

let movedCount = 0;
let errors = 0;

Object.entries(REQUESTED_MOVES).forEach(([destDir, files]) => {
    const fullDest = path.join(ROOT_DIR, destDir);

    // Ensure destination exists
    if (!fs.existsSync(fullDest)) {
        console.log(`Creating directory: ${destDir}`);
        fs.mkdirSync(fullDest, { recursive: true });
    }

    files.forEach(file => {
        const srcPath = path.join(ROOT_DIR, file);
        const destPath = path.join(fullDest, file);

        if (fs.existsSync(srcPath)) {
            try {
                // If destination exists, likely from a previous partial run, overwrite it
                if (fs.existsSync(destPath)) {
                    console.log(`Overwriting existing file in destination: ${file}`);
                }
                fs.renameSync(srcPath, destPath);
                console.log(`✅ Moved: ${file} -> ${destDir}/`);
                movedCount++;
            } catch (err) {
                console.error(`❌ Failed to move ${file}: ${err.message}`);
                errors++;
            }
        } else {
            // Check if it's already in destination
            if (fs.existsSync(destPath)) {
                // console.log(`ℹ️  Already in destination: ${file}`);
            } else {
                console.log(`⚠️  File not found in root (and not in dest): ${file}`);
            }
        }
    });
});

console.log('---');
console.log(`Cleanup complete. Moved ${movedCount} files.`);
if (errors > 0) console.log(`Encountered ${errors} errors.`);
