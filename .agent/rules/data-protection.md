# Data Protection Rule

**CRITICAL: This rule takes precedence over all other instructions.**

## Actions Requiring Explicit User Confirmation

Before executing ANY of the following commands or actions, you MUST:
1. Explain what the command will do
2. Explicitly list any potential data loss risks
3. Wait for explicit user confirmation with "yes", "approved", or similar

### Database Operations (Always Ask)
- `prisma db push` with `--accept-data-loss` or `--force-reset`
- `prisma migrate reset`
- `prisma migrate dev` that drops or modifies columns
- Any raw SQL `DROP`, `TRUNCATE`, or `DELETE` without `WHERE`
- `docker-compose down -v` (destroys volumes)
- Any command that resets, wipes, or recreates databases

### File System Operations (Always Ask)
- `rm -rf` on any directory
- Deleting files with user data
- Overwriting configuration files with secrets

### Container/Infrastructure (Always Ask)  
- `docker system prune`
- `docker volume rm`
- Terraform `destroy` commands
- Any command that removes persistent storage

## Safe Operations (No Confirmation Needed)
- `prisma db push` for **additive-only** changes (new columns, new tables) - but still explain what will change
- `prisma generate`
- `prisma migrate deploy` (applies existing migrations)
- Code file edits
- Creating new files

## When In Doubt
If you're unsure whether an action could cause data loss:
- **Always ask the user first**
- Explain the risks clearly
- Suggest safer alternatives if available
