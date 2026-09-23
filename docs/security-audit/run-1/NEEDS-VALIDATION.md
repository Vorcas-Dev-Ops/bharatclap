# BharatClap Security Audit: Needs-Validation Hypotheses

This document records candidate security hypotheses identified during source analysis whose decisive verdict depends on infrastructure, network topology, or deployment facts not present in repository source code.

---

### bc-nv-cloudflare-tunnel-ingress-waf-rules
#### Cloudflare Tunnel Ingress & Zero Trust Access Restrictions on Admin Routes

- **Verdict**: Needs Validation
- **Subsystem**: `api-gateway` / `customerapp` / Cloudflare Ingress
- **Claimed Root Cause**: Public ingress configuration and Zero Trust Access applications are managed in external Cloudflare dashboards rather than declarative source code.

##### 1. Hypothesis & Risk
The mobile application configuration points to public Cloudflare tunnels (`https://ski-for-distributions-xbox.trycloudflare.com/api`). In the API Gateway, `/api/v1/admin` and `/api/admin` routes are exposed without gateway-level token validation. If the production Cloudflare Tunnel or DNS routing does not enforce Cloudflare Access (requiring Corporate Single Sign-On or identity verification), any public internet caller can reach the vulnerable `admin-service` control plane directly.

##### 2. Blockers
- Cloudflare Tunnel ingress configurations and Cloudflare Access policies are hosted outside this Git repository.
- Live endpoint probing against production trycloudflare.com tunnels is prohibited by audit safety rules.

##### 3. Validation Plan
- **Local Validation**: Inspect local `cloudflared` config YAML files or run a local test tunnel origin with mock Access headers.
- **Deployment Validation**:
  1. Open Cloudflare Zero Trust Dashboard -> Access -> Applications.
  2. Verify an active Access Application protecting `/api/v1/admin/*` and `/api/admin/*`.
  3. Ensure rules require valid corporate identity provider (IdP) authentication.
  4. If no Access rule is present, treat `bc-auth-bypass-admin-service-hardcoded-superadmin` as directly accessible from the public internet.

---

### bc-nv-mongodb-redis-network-firewall-exposure
#### MongoDB & Redis Production Port Firewall Isolation

- **Verdict**: Needs Validation
- **Subsystem**: Infrastructure / `docker-compose.yml`
- **Claimed Root Cause**: `docker-compose.yml` binds database ports to `0.0.0.0` (mapped `27018:27017` and `6379:6379`) without loopback interface restriction.

##### 1. Hypothesis & Risk
`docker-compose.yml` lines 11 and 21 configure:
```yaml
mongodb:
  ports:
    - "27018:27017"
redis:
  ports:
    - "6379:6379"
```
Because no IP address is specified in the port mapping, Docker binds these ports to `0.0.0.0` (all host network interfaces). Connection strings in microservice configurations do not specify authentication passwords (`mongodb://mongodb:27017/auth_db` and `redis://redis:6379`). If deployed on a VPS or cloud VM without strict security group or iptables restrictions, unauthenticated database and cache ports are exposed to public port scanners.

##### 2. Blockers
- Cloud hosting network topology, AWS/GCP security groups, and host firewall rules are not stored in repository source.
- Network scanning against production hosts is prohibited by audit safety rules.

##### 3. Validation Plan
- **Local Validation**: Update `docker-compose.yml` to bind strictly to localhost:
  ```yaml
  ports:
    - "127.0.0.1:27018:27017"
    - "127.0.0.1:6379:6379"
  ```
- **Deployment Validation**:
  1. Inspect cloud provider security groups (e.g. AWS EC2 Security Groups, DigitalOcean Firewalls).
  2. Confirm inbound traffic on ports 27017, 27018, and 6379 is explicitly blocked from `0.0.0.0/0` and restricted strictly to the private VPC subnet or Docker internal bridge.
