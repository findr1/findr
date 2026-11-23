# Findr architecture (Azure)

```mermaid
flowchart LR
  user([Users]) -->|HTTP 80| lb[Load Balancer<br/>public IP]
  dev([Team / CD runner]) -->|SSH 22, allowed IPs only| bastion

  subgraph vnet[Azure VNet]
    subgraph pub[Public subnet]
      bastion[Bastion VM]
    end
    subgraph priv[Private subnet - no public IPs]
      app[App VM<br/>Docker Compose: Findr :80<br/>/metrics :9464, node_exporter :9100]
      mon[Monitoring VM<br/>Prometheus, Grafana,<br/>Alertmanager, blackbox]
    end
  end

  lb -->|port 80, health probe| app
  bastion -->|SSH only from bastion| app
  bastion -->|SSH, Grafana tunnel| mon
  mon -->|scrape 9464 / 9100| app
  mon -->|probe public URL| lb
  app -->|private subnet only| cosmos[(Cosmos DB<br/>MongoDB API)]
  app -->|pull image| acr[(ACR<br/>private registry)]
  mon -->|alerts| discord([Discord])

  subgraph gh[GitHub Actions]
    ci[CI: lint, tests,<br/>Trivy, Checkov] --> cd[CD on merge to main]
  end
  cd -->|push image :sha| acr
  cd -->|OIDC login| azure([Azure])
  cd -->|Ansible via bastion| bastion
  tf[Terraform<br/>state in Azure Storage] -.->|provisions| vnet
```

**Firewall rules (NSGs):** bastion accepts SSH only from allowed IPs (the CD runner's IP is added during a deploy, then removed);
the app VM accepts HTTP only from the Load Balancer, SSH only from the bastion, and metrics only from the monitoring VM;
Cosmos DB accepts connections only from the private subnet. Everything else is denied.
