# Functional Design

## 1. Overview
The Team Management Application is a role-based system designed to facilitate communication, update tracking, and team organization within an operational environment.

## 2. User Roles & Permissions

The system supports a hierarchical role structure:

| Role | Level | Key Responsibilities & Permissions |
|------|-------|------------------------------------|
| **Admin** | System | • Full system access<br>• User management (Approve/Reject/Delete)<br>• Password resets<br>• View all data |
| **SOM (Senior Ops Manager)** | Strategic | • Oversight of Operations Managers<br>• Organization-wide update visibility |
| **OM (Operations Manager)** | Mgmt | • Oversight of Team Leaders<br>• View team updates |
| **Trainer** | Training | • Create updates for all users<br>• Manage training-specific content |
| **Team Leader** | Team | • Create and manage teams<br>• Add/Remove team members<br>• Create team-specific updates<br>• Request member migrations |
| **Team Member** | Operational | • View assigned updates<br>• Acknowledge updates<br>• Read-only access to team data |

## 3. Key Features

### 3.1 Dashboard System
Each role is served a specific dashboard tailored to their needs:
- **Admin Dashboard**: User tables, approval queues, system logs.
- **Manager Dashboards (SOM/OM)**: High-level metrics, update tracking across teams.
- **Team Leader Dashboard**: Team roster management, update creation tools.
- **Team Member Dashboard**: Simplified view for reading updates and submitting acknowledgments.

### 3.2 Update & Communication Management
- **Create Updates**: Leaders can post updates with titles, content, and optional deadlines.
- **Targeting**: Updates can be targeted to specific teams or the entire organization (by Trainers).
- **Acknowledgments**: Users must acknowledge critical updates, providing accountability.
- **Notifications**: Real-time alerts for new updates and deadlines.

### 3.3 Team Management
- **Rostering**: Leaders can add users to their teams using their email.
- **Migrations**: Controlled workflow for moving members between teams (Request -> Approval).

### 3.4 Approval Workflows
- **New Signups**: Admin/Team Leader accounts require Admin approval before access is granted.
- **Migrations**: Moving a member requires approval from the current team leader.
