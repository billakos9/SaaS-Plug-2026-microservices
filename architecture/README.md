# Architecture

This directory contains architecture artifacts for the project.

Current files are Visual Paradigm project files (`.vpp`). They document the
system design, service boundaries, and deployment architecture used by the
codebase.

The runtime source of truth is:

```text
docker-compose.yml
docker-compose.dev.yml
apps/api-gateway/nginx.conf
services/*/src
```

Generated or renamed architecture files should be committed only when they are
the intended final artifact for the report/demo.
