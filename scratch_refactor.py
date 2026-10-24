import os
import re

firestore_path = os.path.join(os.getcwd(), 'src', 'firebase', 'firestore.js')
with open(firestore_path, 'r') as f:
    firestore_content = f.read()

services = {
    'teams': ['createTeam', 'getTeam', 'getTeamsByLeader', 'getAllTeams', 'adminMoveUserToTeam', 'removeUserFromTeam', 'addUserToTeam', 'addMemberToTeam', 'removeMemberFromTeam', 'getTeamMembers', 'getMigrationRequests', 'approveMigration', 'denyMigration'],
    'users': ['updateUserRole', 'getAllUsers', 'getAllTeamMemberUsers', 'getAllTeamLeaderUsers', 'getAllOperationsManagerUsers', 'getPendingTeamLeaders', 'approveTeamLeader', 'rejectTeamLeader', 'getUserByEmail', 'reactivateRejectedUser', 'deleteUserCompletely', 'updateUserProfile', 'updateUserFeatures'],
    'updates': ['createUpdate', 'updateUpdate', 'getUpdatesByTeam', 'deleteUpdate', 'acknowledgeUpdate', 'getAcknowledgmentStatus', 'getUserAcknowledgment', 'getUpdateAcknowledgmentStatus', 'getPendingAcknowledgmentMembers', 'getAcknowledgedMembers', 'getNotifiedUserIdsForUpdate', 'getUpdateAcknowledgmentBreakdown', 'getUpdateAcknowledgmentBreakdownForTrainer', 'bumpUsersForUpdate']
}

extracted_functions = {}

for service, funcs in services.items():
    extracted_functions[service] = {}
    for funcName in funcs:
        # Match from "export const funcName = async" down to the closing "};"
        # Since it's naive regex, we use non-greedy and rely on formatting.
        pattern = re.compile(rf'export const {funcName} = async[\s\S]*?\n}};\n?', re.MULTILINE)
        match = pattern.search(firestore_content)
        if match:
            extracted_functions[service][funcName] = match.group(0)
            firestore_content = firestore_content.replace(match.group(0), '')
        else:
            print(f"Warning: Could not find function {funcName} for {service}")

services_dir = os.path.join(os.getcwd(), 'src', 'services')
if not os.path.exists(services_dir):
    os.makedirs(services_dir)

import_header = "import { db } from '../firebase/config';\nimport { collection, doc, query, getDoc, getDocs, updateDoc, deleteDoc, addDoc, setDoc, where, orderBy, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';\n\n"

for service, funcs_obj in extracted_functions.items():
    file_content = import_header + '\n\n'.join(funcs_obj.values())
    file_path = os.path.join(services_dir, f"{service}.js")
    with open(file_path, 'w') as f:
        f.write(file_content)
    print(f"Created src/services/{service}.js with {len(funcs_obj)} functions.")

with open(firestore_path, 'w') as f:
    f.write(firestore_content)
print('Updated firestore.js')

def update_imports(dir_path):
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith('.js') and os.path.join(root, file) != firestore_path:
                full_path = os.path.join(root, file)
                with open(full_path, 'r') as f:
                    content = f.read()
                
                changed = [False]
                
                def replace_match(match):
                    imports_str = match.group(1)
                    rel_path = match.group(2)
                    imports = [i.strip() for i in imports_str.split(',')]
                    
                    new_imports_map = {'firestore': [], 'teams': [], 'users': [], 'updates': []}
                    for imp in imports:
                        if imp in services['teams']:
                            new_imports_map['teams'].append(imp)
                        elif imp in services['users']:
                            new_imports_map['users'].append(imp)
                        elif imp in services['updates']:
                            new_imports_map['updates'].append(imp)
                        else:
                            new_imports_map['firestore'].append(imp)
                    
                    new_lines = []
                    if new_imports_map['firestore']:
                        new_lines.append(f"import {{ {', '.join(new_imports_map['firestore'])} }} from '{rel_path}firebase/firestore';")
                    if new_imports_map['teams']:
                        new_lines.append(f"import {{ {', '.join(new_imports_map['teams'])} }} from '{rel_path}services/teams';")
                    if new_imports_map['users']:
                        new_lines.append(f"import {{ {', '.join(new_imports_map['users'])} }} from '{rel_path}services/users';")
                    if new_imports_map['updates']:
                        new_lines.append(f"import {{ {', '.join(new_imports_map['updates'])} }} from '{rel_path}services/updates';")
                    
                    changed[0] = True
                    return '\n'.join(new_lines)
                
                import_pattern = re.compile(r"import\s+{([^}]+)}\s+from\s+['\"]([^'\"]+)firebase/firestore['\"];?")
                new_content = import_pattern.sub(replace_match, content)
                
                if changed[0]:
                    with open(full_path, 'w') as f:
                        f.write(new_content)
                    print(f"Updated imports in {full_path}")

update_imports(os.path.join(os.getcwd(), 'src'))
print('Done.')
