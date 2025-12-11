# Contributing Guidelines

## Code Standards

### Microsoft Entra ID OIDC Guidelines

- Follow Microsoft's official OIDC implementation guidelines
- Use PKCE for all authorization code flows
- Implement proper token validation
- Never expose tokens or credentials in errors

### Microsoft 365 Agents SDK Best Practices

- Follow the official SDK documentation
- Use proper error handling for Graph API calls
- Implement retry logic for transient failures
- Cache tokens appropriately

### Code Quality

- **Modular Design**: Each module should have a single responsibility
- **Type Safety**: Use TypeScript types and interfaces everywhere
- **Documentation**: JSDoc comments for all public APIs
- **Error Handling**: Comprehensive error handling with sanitized messages

## Security Requirements

### Never Log:

- Secrets or passwords
- Access tokens or refresh tokens
- PII (Personally Identifiable Information)
- Email addresses in full
- User IDs that could identify individuals

### Always:

- Use the logger utility which automatically sanitizes logs
- Validate all user inputs
- Use parameterized queries (if using a database)
- Implement proper session management
- Follow OWASP security guidelines

## Testing Requirements

- Write tests for every major feature
- Aim for >80% code coverage
- Include unit tests and integration tests
- Test error cases and edge cases
- Mock external dependencies

## Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Methods**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces/Types**: `PascalCase`

## Commit Messages

Use clear, descriptive commit messages:

```
feat: Add Microsoft Graph user info endpoint
fix: Sanitize email addresses in logs
docs: Update authentication setup guide
test: Add tests for chatbot service
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the guidelines
3. Write/update tests
4. Ensure all tests pass
5. Update documentation if needed
6. Submit PR with clear description

## Code Review Checklist

Before submitting a PR, ensure:

- [ ] All tests pass
- [ ] No secrets or PII in code or logs
- [ ] Follows naming conventions
- [ ] TypeScript compiles without errors
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Security considerations addressed
