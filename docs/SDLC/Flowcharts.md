# Application Flowcharts

## 1. Signup Process

This flowchart describes the user registration, role selection, and approval workflow.

```mermaid
graph TD
    A[User Visits /login] --> B{Has Account?}
    B -- Yes --> C[Login]
    B -- No --> D[Sign Up Form]
    
    D --> E[Enter Email, Password, Name]
    E --> F[Select Role]
    F --> G{Role Type}
    
    G -- Team Member --> H[Register in Auth & Firestore]
    H --> I[Status: Active]
    I --> J[Redirect to /team-member]
    
    G -- Admin/Team Leader --> K[Register in Auth & Firestore]
    K --> L[Status: Pending Approval]
    L --> M[Redirect to /pending-approval]
    
    M --> N{Admin Action}
    N -- Approve --> O[Update Status: Active]
    O --> P[User Access Granted]
    N -- Reject --> Q[Delete User/Deny Access]
```

## 2. General System Architecture

This flowchart illustrates the high-level interaction between the Frontend, Firebase Services, and different User Roles.

```mermaid
graph TD
    subgraph Client [Frontend - React]
        UI[User Interface]
        Auth[Auth Context]
        Router[React Router]
    end

    subgraph Backend [Firebase Services]
        FbAuth[Authentication]
        Firestore[Cloud Firestore]
        Functions[Cloud Functions]
    end

    User((User)) --> UI
    UI --> Auth
    Auth --> FbAuth

    UI --> Firestore
    Firestore --> UI
    
    UI --> Functions
    Functions --> Firestore
    Functions --> FbAuth

    subgraph Roles [Dashboards]
        Admin[Admin Dashboard]
        TL[Team Leader Dashboard]
        TM[Team Member Dashboard]
        OM[Ops Manager Dashboard]
    end

    Router --> Admin
    Router --> TL
    Router --> TM
    Router --> OM

    Admin -- CRUD --> Firestore
    TL -- Manage Team --> Firestore
    TM -- View Updates --> Firestore
```
