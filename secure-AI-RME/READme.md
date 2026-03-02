# A Secure AI integrated Decision Suppport

Frontend : Typescript with Next.Js framework
Backend : Python with Flask framework

# Project Structure

   ```bash
CAPSTONE
├── backend/
| └── app/
| └── app.py
└── frontend/
└── medical-record/
├── public/
└── src/
├── (auth)/
├──login/
| ├── page.tsx
| └── login.module.css
|
├── register/
| ├── page.tsx
| └── login.module.css
|
├── glocal.css
├── layout.tsx
├── page.tsx
├── component/
|
├── services/
|
└── middleware.ts
```

# Prerequisites

- Python 3.14.3
- Node Js v24.13.0

# Setup & Installation

1. Backend (Python)

   ```bash
       cd secure-AI-RME/backend

       # Create virtual environment
       python -m venv venv

       # Activate it (Windows)
       venv\Scripts\activate

       # Activate it (Mac/Linux)
       source venv/bin/activate

       # Install dependencies
       pip install flask

       # Run Server
       python app.py
 ```

2. Frontend Setup
   ```bash
      cd secure-AI-RME/frontend/medical-record
      npm install
     npm run dev
   ```
