# Production Readiness Checklist

Use this checklist to ensure your deployment meets production-grade security, performance, and reliability standards.

## Security Checklist

### Secret Management

- [ ] **Azure Key Vault configured**
  - [ ] Key Vault created with soft delete enabled
  - [ ] Purge protection enabled
  - [ ] Managed Identity configured for Key Vault access
  - [ ] Access policies correctly set (minimum required permissions)
  - [ ] All secrets stored in Key Vault (no plaintext in environment variables)

- [ ] **Secret Rotation Validated**
  - [ ] Client secret rotation tested
  - [ ] Refresh token rotation tested
  - [ ] Signing key rotation tested (if applicable)
  - [ ] Rotation process documented
  - [ ] Automated rotation configured (if applicable)

- [ ] **No Plaintext Tokens**
  - [ ] Access tokens never logged
  - [ ] Refresh tokens stored in Key Vault only
  - [ ] Client secrets retrieved from Key Vault
  - [ ] No tokens in error messages
  - [ ] No tokens in query parameters
  - [ ] No tokens in URL paths

### Authentication & Authorization

- [ ] **OIDC Implementation**
  - [ ] PKCE flow implemented and tested
  - [ ] State parameter validation working
  - [ ] Code verifier stored securely
  - [ ] Token validation implemented
  - [ ] Token refresh working correctly

- [ ] **Session Management**
  - [ ] Session JWTs signed and validated
  - [ ] Session expiration configured
  - [ ] Session invalidation on logout
  - [ ] Secure cookie flags (HttpOnly, Secure, SameSite)
  - [ ] Session timeout tested

### Network Security

- [ ] **HTTPS Enforced**
  - [ ] HTTPS-only enabled in production
  - [ ] SSL/TLS certificates valid
  - [ ] Certificate expiration monitoring configured
  - [ ] HSTS header enabled
  - [ ] HTTP to HTTPS redirect working

- [ ] **CORS Configuration**
  - [ ] Strict allowlist configured (no wildcards)
  - [ ] Only required origins in allowlist
  - [ ] Credentials configured correctly
  - [ ] CORS tested with all allowed origins
  - [ ] CORS rejection tested

- [ ] **Security Headers**
  - [ ] Content-Security-Policy configured
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection enabled
  - [ ] Referrer-Policy configured
  - [ ] Permissions-Policy configured

### Rate Limiting

- [ ] **Rate Limiting Configured**
  - [ ] General API rate limiting active
  - [ ] Authentication endpoint rate limiting stricter
  - [ ] Rate limits appropriate for expected load
  - [ ] Rate limit headers returned
  - [ ] Rate limit bypass tested and prevented

### Input Validation

- [ ] **Request Validation**
  - [ ] All inputs validated
  - [ ] SQL injection prevention (if applicable)
  - [ ] XSS prevention
  - [ ] Command injection prevention
  - [ ] File upload validation (if applicable)

## Logging & Monitoring

### Logging

- [ ] **PII Protection**
  - [ ] No PII in logs
  - [ ] Email addresses sanitized
  - [ ] User IDs sanitized where appropriate
  - [ ] Log sanitization tested
  - [ ] Logger utility used consistently

- [ ] **Log Management**
  - [ ] Log levels configured appropriately
  - [ ] Log retention policy configured
  - [ ] Log rotation configured
  - [ ] Centralized logging configured (Application Insights)
  - [ ] Sensitive data never logged

### Monitoring

- [ ] **Application Monitoring**
  - [ ] Application Insights configured
  - [ ] Health endpoint monitored
  - [ ] Error rate monitoring
  - [ ] Response time monitoring
  - [ ] Dependency tracking enabled

- [ ] **Alerting**
  - [ ] Error rate alerts configured
  - [ ] Response time alerts configured
  - [ ] Health check failures alert
  - [ ] Key Vault access failure alerts
  - [ ] Rate limit violation alerts

## Performance

- [ ] **Performance Testing**
  - [ ] Load testing completed
  - [ ] Response times acceptable
  - [ ] Concurrent user capacity tested
  - [ ] Database performance optimized (if applicable)
  - [ ] Caching strategy implemented

- [ ] **Scalability**
  - [ ] Auto-scaling configured
  - [ ] Scaling policies tested
  - [ ] Resource limits defined
  - [ ] Cost optimization reviewed
  - [ ] **Per-user conversation storage migrated to shared storage (Redis)**
    - [ ] Current implementation uses in-process memory only
    - [ ] For multi-instance deployments, migrate conversation mapping to Redis
    - [ ] Conversation isolation verified across instances

## Reliability

- [ ] **High Availability**
  - [ ] Multi-instance deployment (if applicable)
  - [ ] Load balancer configured
  - [ ] Health checks configured
  - [ ] Failover tested

- [ ] **Backup & Recovery**
  - [ ] Backup strategy defined
  - [ ] Backup restoration tested
  - [ ] Disaster recovery plan documented
  - [ ] Recovery time objectives defined
  - [ ] Recovery point objectives defined

- [ ] **Error Handling**
  - [ ] Graceful error handling
  - [ ] User-friendly error messages
  - [ ] No sensitive data in errors
  - [ ] Error logging comprehensive
  - [ ] Circuit breakers implemented (if applicable)

## Configuration

- [ ] **Environment Configuration**
  - [ ] Production environment variables documented
  - [ ] Configuration validated on startup
  - [ ] Sensitive configs in Key Vault
  - [ ] Configuration version controlled (safely)
  - [ ] Configuration changes tested

- [ ] **Feature Flags**
  - [ ] Feature flags implemented (if needed)
  - [ ] Feature flag rollback tested
  - [ ] Feature flag documentation

## Compliance

- [ ] **Data Protection**
  - [ ] GDPR compliance verified (if applicable)
  - [ ] Data retention policies defined
  - [ ] Data deletion procedures documented
  - [ ] Privacy policy updated

- [ ] **Audit Trail**
  - [ ] Audit logging enabled
  - [ ] Authentication events logged
  - [ ] Authorization failures logged
  - [ ] Sensitive operations logged
  - [ ] Audit logs retained appropriately

## Documentation

- [ ] **Technical Documentation**
  - [ ] Architecture documented
  - [ ] API documentation complete (OpenAPI/Swagger)
  - [ ] Deployment guide complete
  - [ ] Migration guide complete (if applicable)
  - [ ] Runbooks for operations team

- [ ] **Security Documentation**
  - [ ] Security architecture documented
  - [ ] Threat model documented
  - [ ] Incident response plan documented
  - [ ] Security contact information

## Testing

- [ ] **Test Coverage**
  - [ ] Unit test coverage >80%
  - [ ] Integration tests passing
  - [ ] End-to-end tests passing
  - [ ] Security tests completed
  - [ ] Performance tests completed

- [ ] **Test Automation**
  - [ ] CI/CD pipeline configured
  - [ ] Automated tests in CI/CD
  - [ ] Test failures block deployment
  - [ ] Test results monitored

## Deployment

- [ ] **Deployment Process**
  - [ ] Deployment procedure documented
  - [ ] Rollback procedure tested
  - [ ] Blue-green deployment (if applicable)
  - [ ] Canary deployment (if applicable)
  - [ ] Deployment automation verified

- [ ] **Pre-Deployment Checks**
  - [ ] All tests passing
  - [ ] Security scan passed
  - [ ] Dependency vulnerabilities resolved
  - [ ] Code review completed
  - [ ] Performance benchmarks met

## Post-Deployment

- [ ] **Verification**
  - [ ] Health endpoint verified
  - [ ] Authentication flow tested
  - [ ] All endpoints responding
  - [ ] Monitoring dashboards updated
  - [ ] Alerts verified

- [ ] **Monitoring**
  - [ ] Error rates monitored for 24 hours
  - [ ] Performance metrics reviewed
  - [ ] User feedback collected
  - [ ] Incident response team notified

## Sign-Off

- [ ] **Development Team**
  - [ ] Code review completed
  - [ ] All tests passing
  - [ ] Documentation complete

- [ ] **Security Team**
  - [ ] Security review completed
  - [ ] Vulnerabilities addressed
  - [ ] Compliance verified

- [ ] **Operations Team**
  - [ ] Monitoring configured
  - [ ] Alerts configured
  - [ ] Runbooks reviewed
  - [ ] On-call rotation updated

- [ ] **Product Team**
  - [ ] Features tested
  - [ ] User acceptance criteria met
  - [ ] Release notes prepared

---

## Quick Reference: Critical Security Items

Before going to production, ensure these are ALL checked:

1. ✅ **HTTPS enforced** - No HTTP in production
2. ✅ **No plaintext secrets** - All in Key Vault
3. ✅ **No PII in logs** - Sanitization verified
4. ✅ **CORS strict allowlist** - No wildcards
5. ✅ **Rate limiting active** - Prevents abuse
6. ✅ **Security headers set** - CSP, HSTS, etc.
7. ✅ **PKCE implemented** - Secure OAuth flow
8. ✅ **Session security** - Secure cookies, expiration
9. ✅ **Monitoring active** - Errors and performance tracked
10. ✅ **Rollback tested** - Can revert if needed

---

**Last Updated:** [Date]  
**Reviewed By:** [Name]  
**Approved By:** [Name]
