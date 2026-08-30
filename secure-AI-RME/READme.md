# A Secure AI integrated Decision Suppport

Frontend: TypeScript with Next.js Framework  
Backend: Python with Flask Framework

## Project Structure

```bash
secure-AI-RME/
├── .gitignore
├── READme.md
├── backend/
│   ├── app/                      # Application modules, blueprints, and utilities
│   ├── forecast/                 # Time series forecasting and analytic models
│   ├── venv/                     # Python virtual environment (ignored in git)
│   ├── .env                      # Backend environment configuration
│   ├── app.py                    # Flask server entry point
│   ├── db.sql                    # Database migration & schema script
│   └── requirements.txt          # Python package dependencies
└── frontend/
    └── medical-record/
        ├── .next/                # Next.js build output (ignored in git)
        ├── node_modules/         # Dependencies (ignored in git)
        ├── public/               # Static assets & icons
        ├── src/
        │   ├── app/              # Next.js App Router root
        │   │   ├── (auth)/       # Authentication & onboarding routes
        │   │   │   ├── login/
        │   │   │   │   ├── page.tsx
        │   │   │   │   └── login.module.css
        │   │   │   ├── register/
        │   │   │   │   ├── page.tsx
        │   │   │   │   └── signin.module.css
        │   │   │   └── create-clinic/
        │   │   │       ├── page.tsx
        │   │   │       └── registerClinic.module.css
        │   │   ├── (pages)/      # Main protected application modules
        │   │   │   ├── account-setting/
        │   │   │   ├── activity-history/
        │   │   │   ├── daily-report/
        │   │   │   ├── dashboard/
        │   │   │   ├── financial-report/
        │   │   │   ├── management-setting/
        │   │   │   ├── medical-record/
        │   │   │   └── layout.tsx
        │   │   ├── globals.css   # Global styles
        │   │   ├── layout.tsx    # Root layout wrapper
        │   │   └── page.tsx      # Root landing/entry page
        │   ├── components/       # Reusable UI elements (cards, inputs, tables, icons)
        │   ├── fonts/            # Local and optimized font declarations
        │   ├── utils/            # Helper utilities and API clients (app.ts)
        │   ├── global.d.ts       # Global TypeScript definitions
        │   └── middleware.ts     # Route protection & session guard
        ├── .env                  # Frontend environment configuration
        ├── eslint.config.mjs     # ESLint configuration
        ├── next-env.d.ts         # Next.js TypeScript declarations
        ├── next.config.ts        # Next.js configuration
        ├── package.json          # Node dependencies & project scripts
        ├── package-lock.json     # Dependency lockfile
        ├── postcss.config.mjs    # PostCSS styling rules
        └── tsconfig.json         # TypeScript compiler configuration
```

## Prerequisites

- Python 3.14.3
- Node Js v24.13.0

## Setup & Installation

1. Backend (Python)

   ```bash
       cd secure-AI-RME/backend

       # Create virtual environment
       python -m venv venv

       # Activate it (Windows)
       venv\Scripts\activate

       # Install dependencies
       pip install -r requirements.txt

       # Run Server
       python app.py
   ```

2. Frontend Setup

   ```bash
      cd secure-AI-RME/frontend/medical-record
      npm install
      npm run dev
   ```

## Testong Account
| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin2@gmail.com` | `admin123` |
| **Midwife** | `bidan@gmail.com` | `bidan123` |
| **Assistant** | `asisten@gmail.com` | `asisten123` |

