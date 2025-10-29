# Backend
Handles APIs, database, and off-chain logic for FlightStakeFi.

## Scripts
- `npm run dev` – start backend (placeholder)

# Backend Service Dependencies

This backend service relies on several external services to run locally.

## 1. PostgreSQL Database
The backend uses Postgres as its main "filing cabinet" (database).

**Setup Instructions (Ubuntu/Debian):**
1.  Install: `sudo apt install postgresql postgresql-client`
2.  Log in as admin: `sudo -u postgres psql`
3.  Inside psql (the `postgres=#` prompt), create the user:
    `CREATE USER dev_user WITH PASSWORD 'devpass';`
4.  Inside psql, create the database:
    `CREATE DATABASE flightstakefi_dev OWNER dev_user;`
5.  Quit admin: `\q`

**Verification:**
Run this command from your terminal. The password is `devpass`.
```bash
psql -h localhost -U dev_user -d flightstakefi_dev