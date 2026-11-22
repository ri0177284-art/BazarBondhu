# BazarBondhu

BazarBondhu is a Bengali-first online grocery storefront with an admin workspace for managing products, stock, orders, customers, and checkout fees.

## Features

- Customer registration and sign-in with Supabase Auth
- Product browsing, category selection, search, stock-aware cart, and checkout
- Cash on delivery and mobile payment reference collection
- Customer order history and cancellation flow
- Admin dashboard with daily totals, a seven-day sales chart, and low-stock cues
- Product and market-price management, order and payment status updates, customer list, and checkout settings
- Responsive layouts for desktop and mobile

## Requirements

- Node.js 20.19+ or 22.12+
- A Supabase project with the tables, row-level security policies, and RPC functions used by the app

The customer checkout expects `create_order_with_payment_atomic` and `cancel_order_atomic` RPC functions. Their database definitions and the required RLS policies are not included in this repository. Deploy and review those on the server before accepting real orders. The order creation RPC must validate prices, charges, stock, and user ownership on the server; client-side checks are only for user feedback.

## Setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and add your Supabase project URL and **publishable/anon client key**.
3. Start the local app with `npm run dev`.

```sh
npm run lint
npm run build
npm run preview
```

Only a Supabase publishable/anon key belongs in the browser. Never put a `service_role` key or other secret in a `VITE_` variable.

## Routes

- `/` — admin sign-in and workspace
- `/customer` — customer storefront

The admin workspace checks the signed-in user's `profiles.role`. Database policies must enforce the same authorization independently of the UI.

