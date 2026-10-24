# Technical Design

## 1. Database Design (Cloud Firestore)

The application uses a NoSQL document-oriented database.

### Collections

#### `users`
Stores user profile and role information.
- **Fields**: `email`, `displayName`, `role`, `teamId`, `isApproved`, `status`
- **Security**: Readable by owner and Admin. Public read for some profile fields if needed.

#### `teams`
Represents organizational units.
- **Fields**: `name`, `teamLeaderId`, `description`, `members` (array of userIds)
- **Relationships**: One-to-Many with Users (via `members` array and `users.teamId`).

#### `updates`
Content posted by leaders.
- **Fields**: `title`, `content`, `deadline`, `teamId`, `createdBy`
- **Logic**: Can be targeted to a specific `teamId` or global (`trainer-updates`).

#### `acknowledgments`
Tracks user interaction with updates.
- **Fields**: `updateId`, `userId`, `comment`, `acknowledgedAt`
- **Purpose**: Compliance and read-receipt tracking.

#### `notifications`
System alerts for users.
- **Fields**: `userId`, `type`, `message`, `isRead`

#### `migrations`
Requests to move users between teams.
- **Fields**: `userId`, `fromTeamId`, `toTeamId`, `status` ('pending', 'approved', 'denied')

## 2. API & Backend Logic (Cloud Functions)

Detailed business logic is handled via Firebase Cloud Functions to ensure security and data integrity.

### Endpoints
* **resetUserPassword**: Admin-only function to reset a user's password without needing their old credential.
* **deleteUserFromAuth**: Admin-only function to completely remove a user from Firebase Authentication.

### Triggers
* **onCreate(user)**: (Potential) Initialize default data for new users.
* **onDelete(user)**: Clean up related data (acknowledgments, team membership) when a user is deleted.

## 3. Security Model

Security is enforced at the database level using Firestore Security Rules (`firestore.rules`).

### Authorization Principles
1. **Least Privilege**: Users only access data relevant to their role and team.
2. **Role-Based Access**:
    - `request.auth.token.role` is checked for Admin/Manager actions.
3. **Team Scoping**:
    - Team Members can only read updates where `resource.data.teamId == user.teamId`.
    - Team Leaders can only write updates to teams they own.

## 4. Scalability Considerations
- **Indexes**: Composite indexes required for querying updates by team AND date.
- **Pagination**: Dashboard lists should be paginated to handle large team sizes.
- **Caching**: React Query or similar recommended for client-side caching to reduce Firestore reads.
