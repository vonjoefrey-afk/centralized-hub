const fs = require('fs');
const path = require('path');

const firestorePath = path.join(__dirname, 'src', 'firebase', 'firestore.js');
let firestoreContent = fs.readFileSync(firestorePath, 'utf8');

const services = {
  'teams': ['createTeam', 'getTeam', 'getTeamsByLeader', 'getAllTeams', 'adminMoveUserToTeam', 'removeUserFromTeam', 'addUserToTeam', 'addMemberToTeam', 'removeMemberFromTeam', 'getTeamMembers', 'getMigrationRequests', 'approveMigration', 'denyMigration'],
  'users': ['updateUserRole', 'getAllUsers', 'getAllTeamMemberUsers', 'getAllTeamLeaderUsers', 'getAllOperationsManagerUsers', 'getPendingTeamLeaders', 'approveTeamLeader', 'rejectTeamLeader', 'getUserByEmail', 'reactivateRejectedUser', 'deleteUserCompletely', 'updateUserProfile', 'updateUserFeatures'],
  'updates': ['createUpdate', 'updateUpdate', 'getUpdatesByTeam', 'deleteUpdate', 'acknowledgeUpdate', 'getAcknowledgmentStatus', 'getUserAcknowledgment', 'getUpdateAcknowledgmentStatus', 'getPendingAcknowledgmentMembers', 'getAcknowledgedMembers', 'getNotifiedUserIdsForUpdate', 'getUpdateAcknowledgmentBreakdown', 'getUpdateAcknowledgmentBreakdownForTrainer', 'bumpUsersForUpdate']
};

const extractedFunctions = {};

for (const [service, funcs] of Object.entries(services)) {
  extractedFunctions[service] = {};
  for (const funcName of funcs) {
    const regex = new RegExp(`export const ${funcName} = async[\\s\\S]*?\\n};`, 'm');
    const match = firestoreContent.match(regex);
    if (match) {
      extractedFunctions[service][funcName] = match[0];
      firestoreContent = firestoreContent.replace(match[0], '');
    } else {
      console.log(`Warning: Could not find function ${funcName} for ${service}`);
    }
  }
}

// Ensure src/services directory exists
const servicesDir = path.join(__dirname, 'src', 'services');
if (!fs.existsSync(servicesDir)) {
  fs.mkdirSync(servicesDir);
}

// Write the new service files
for (const [service, funcsObj] of Object.entries(extractedFunctions)) {
  const fileContent = `import { db } from '../firebase/config';\nimport { collection, doc, query, getDoc, getDocs, updateDoc, deleteDoc, addDoc, setDoc, where, orderBy, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';\n\n` + 
    Object.values(funcsObj).join('\n\n');
  fs.writeFileSync(path.join(servicesDir, `${service}.js`), fileContent);
  console.log(`Created src/services/${service}.js with ${Object.keys(funcsObj).length} functions.`);
}

fs.writeFileSync(firestorePath, firestoreContent);
console.log('Updated firestore.js');

// Now, recursively scan src/ folder and update imports
const updateImports = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      updateImports(fullPath);
    } else if (fullPath.endsWith('.js') && fullPath !== firestorePath) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Extract all firestore.js imports in the file
      const firestoreImportRegex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)firebase\/firestore['"];?/g;
      
      content = content.replace(firestoreImportRegex, (match, importsStr, relPath) => {
        const imports = importsStr.split(',').map(s => s.trim());
        const newImportsMap = { firestore: [], teams: [], users: [], updates: [] };
        
        imports.forEach(imp => {
          if (services.teams.includes(imp)) newImportsMap.teams.push(imp);
          else if (services.users.includes(imp)) newImportsMap.users.push(imp);
          else if (services.updates.includes(imp)) newImportsMap.updates.push(imp);
          else newImportsMap.firestore.push(imp);
        });

        const newImportLines = [];
        if (newImportsMap.firestore.length > 0) {
          newImportLines.push(`import { ${newImportsMap.firestore.join(', ')} } from '${relPath}firebase/firestore';`);
        }
        if (newImportsMap.teams.length > 0) {
          newImportLines.push(`import { ${newImportsMap.teams.join(', ')} } from '${relPath}services/teams';`);
        }
        if (newImportsMap.users.length > 0) {
          newImportLines.push(`import { ${newImportsMap.users.join(', ')} } from '${relPath}services/users';`);
        }
        if (newImportsMap.updates.length > 0) {
          newImportLines.push(`import { ${newImportsMap.updates.join(', ')} } from '${relPath}services/updates';`);
        }
        
        changed = true;
        return newImportLines.join('\n');
      });

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
};

updateImports(path.join(__dirname, 'src'));
console.log('Done mapping imports.');
