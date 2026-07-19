# Payment Reconciliation System

A full-stack **Payment Reconciliation System** that compares uploaded **Orders** and **Payments** CSV files, detects discrepancies using deterministic business rules, stores reconciliation results in MongoDB, provides an interactive dashboard, and generates AI-powered explanations for detected issues.

---

# Features

* User Authentication (JWT + bcrypt)
* CSV Upload for Orders and Payments
* Batch-based Reconciliation
* Deterministic Reconciliation Engine
* Dashboard with Summary Analytics
* Discrepancy Listing with Filtering
* AI-powered Discrepancy Explanation
* Secure REST APIs
* MongoDB Data Storage

---

# Tech Stack

## Frontend
* React
* Vite
* Tailwind CSS

## Backend
* Node.js
* Express.js

## Database
* MongoDB

## Authentication
* JWT
* bcrypt

## File Processing
* Multer
* csv-parser

## AI
* Groq API (Llama Model)
---

# Installation

## Clone Repository

```bash
git clone <repository-url>
```
---

## Backend
```bash
cd backend
npm install
```
---

## Frontend
```bash
cd frontend
npm install
```

---

# Environment Variables

Create a `.env` file inside the backend directory.

```env
PORT=4000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
CORS_ORIGIN=http://localhost:5173
```
---

# Running the Project

## Start Backend

```bash
npm run dev
```

---

## Start Frontend

```bash
npm run dev
```

Frontend

```
http://localhost:5173
```

Backend

```
http://localhost:4000
```

---

# Workflow

1. Register/Login.
2. Upload Orders CSV.
3. Upload Payments CSV.
4. Start Reconciliation.
5. View Dashboard Summary.
6. Review Discrepancies.
7. Generate AI Explanation.

---

# API Endpoints

## Authentication

```
POST /api/auth/register

POST /api/auth/login
```

---

## Upload

```
POST /api/ingest/orders

POST /api/ingest/payments
```

---

## Reconciliation

```
POST /api/reconciliation/run
```

---

## Dashboard

```
GET /api/dashboard/summary

GET /api/dashboard/discrepancies

GET /api/dashboard/discrepancies/:id
```

---

## AI

```
POST /api/explain/:id
```

---

# Reconciliation Rules

* **MISSING_PAYMENT**

  * Condition: A completed order has no settled charge associated with it.
  * Severity: High

* **ORPHAN_PAYMENT**

  * Condition: A settled charge references an order that does not exist in the uploaded batch.
  * Severity: Medium

* **PAYMENT_NOT_SETTLED**

  * Condition: A completed order has only pending or failed payment records.
  * Severity:

    * High (Failed)
    * Medium (Pending)

* **DUPLICATE_CHARGE**

  * Condition: Two or more settled charges of the same amount exist for the same order and are not offset by a refund.
  * Severity: High

* **AMOUNT_MISMATCH**

  * Condition: The net settled amount differs from the expected order value beyond the configured tolerance, excluding duplicate-charge and refund scenarios.
  * Severity:

    * High (Overcharged)
    * Medium (Undercharged)

* **REFUND_SHORTFALL**

  * Condition: An order is refunded (or partially refunded), but the refunded amount does not bring the net settled amount back to the expected value.
  * Severity: High

* **CANCELLED_BUT_CHARGED**

  * Condition: An order is marked as cancelled, but a positive amount was still collected.
  * Severity: High

* **CURRENCY_MISMATCH**

  * Condition: The order and payment amounts match numerically, but the currency codes differ.
  * Severity: Low (Informational)

* **DUPLICATE_ORDER_RECORD**

  * Condition: The same normalized `order_id` appears multiple times in the uploaded Orders CSV with different data. Exact duplicate rows are automatically ignored.
  * Severity:

    * High (Different Amounts)
    * Medium (Same Amounts)

---

# Dashboard Features

The dashboard provides:

* Total Orders
* Total Payments
* Total Reconciled Orders
* Total Discrepancies
* Total Amount at Risk
* Discrepancies by Severity
* Discrepancies by Type
* Batch Summary
* Pagination
* Search
* Filtering

---

# AI Explanation

Artificial Intelligence is **not used** to determine reconciliation results.

Instead, AI is used **only after** the reconciliation engine has identified a discrepancy.

The AI generates:

* Business-friendly explanation
* Possible reason
* Financial impact
* Suggested resolution

This ensures that reconciliation remains deterministic while AI improves readability and user experience.

---

# Assumptions

* Orders and Payments belong to the same uploaded batch.
* Only settled charges are considered successful payments.
* Pending and failed payments are not treated as successful settlements.
* Exact duplicate order rows are ignored during ingestion.
* Floating-point comparison uses a configurable tolerance.
* AI is used only for explanations and never makes reconciliation decisions.

---

# Security

* Passwords are hashed using bcrypt.
* JWT is used for authentication.
* Protected API routes.
* Environment variables store secrets.
* CORS configuration.
* Input validation.
* Centralized error handling.
---
