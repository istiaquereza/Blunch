# Bento POS — Restaurant Management System

## Quick Start

### 1. Install dependencies
```bash
cd bento-pos
npm install
```

### 2. Set up Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and paste the contents of `supabase/schema.sql` — run it
3. Copy your project URL and anon key from **Settings → API**

### 3. Configure environment
Edit `.env.local` and replace placeholders:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Build Layers

| Layer | Status | Scope |
|-------|--------|-------|
| **Layer 1** | ✅ Done | Auth, layout, navigation shell, DB schema |
| **Layer 2** | 🔜 Next | Food module (Menu, Ingredients, Recipe) |
| **Layer 3** | 🔜 | Inventory (Assets, Food Inventory, Bazar Requests) |
| **Layer 4** | 🔜 | Settings, CRM, Sells & Expenses |
| **Layer 5** | 🔜 | Orders (New Order POS, Order Details) |
| **Layer 6** | 🔜 | Dashboard charts, Reports, Print |

## Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + Storage)
- **UI Components**: Radix UI primitives
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
