# Database migrations

Migrations are append-only and ordered by numeric prefix. Never edit an applied production migration; add a new migration instead.

Milestone 0 uses plain PostgreSQL SQL deliberately so the database contract is not coupled to an ORM before the domain model stabilizes.

Apply locally with your preferred migration runner or, for a disposable development database:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/migrations/0001_foundation.sql
```

Production deployment must apply migrations through a controlled release job with backups and rollback/forward-fix procedures.
