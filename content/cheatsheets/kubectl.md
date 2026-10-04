---
title: kubectl
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Kubernetes 1.30
tags: [kubernetes, k8s, devops]
sources: [kubernetes.io/docs/reference/kubectl]
---

Everyday Kubernetes commands for checking, debugging and rolling out workloads.

## Context and namespaces

- Always confirm the current context before changing anything
- Set a default namespace instead of typing `-n` every time
- `kubectx`/`kubens` are handy if installed

```bash
kubectl config get-contexts
kubectl config current-context
kubectl config use-context eks-uat
kubectl config set-context --current --namespace=devtoolkit
```

## Get and describe

- `get` lists; `-o wide` adds node/IP; `-o yaml` shows the full object
- `describe` shows events — the first place to look when something is stuck
- `-A` lists across all namespaces

```bash
kubectl get pods -o wide
kubectl get deploy,svc,ingress
kubectl describe pod devtoolkit-7d9f8c6b5-abcde
kubectl get events --sort-by=.lastTimestamp | tail -20
kubectl get pods -A | grep -v Running
```

## Logs and exec

- `--previous` shows logs from the last crashed container
- `-c` picks a container in multi-container pods
- `exec` for a shell; `port-forward` to reach a pod locally

```bash
kubectl logs -f deploy/devtoolkit --tail=200
kubectl logs devtoolkit-7d9f8c6b5-abcde --previous
kubectl exec -it deploy/devtoolkit -- sh
kubectl port-forward svc/devtoolkit 8080:80
```

## Deployments and rollouts

- Apply declarative YAML; avoid editing live objects by hand
- Watch rollouts; undo if they fail
- `restart` rolls pods without changing the spec

```bash
kubectl apply -f k8s/
kubectl set image deploy/devtoolkit app=registry.internal/devtoolkit:1.2.1
kubectl rollout status deploy/devtoolkit
kubectl rollout history deploy/devtoolkit
kubectl rollout undo deploy/devtoolkit
kubectl rollout restart deploy/devtoolkit
```

## Scaling and resources

- Set requests and limits on every container
- `top` needs metrics-server
- HPA scales on CPU or custom metrics

```bash
kubectl scale deploy/devtoolkit --replicas=4
kubectl top pods
kubectl autoscale deploy/devtoolkit --min=2 --max=6 --cpu-percent=70
kubectl get hpa
```

## Config and secrets

- ConfigMaps for settings, Secrets for credentials
- Secrets are only base64-encoded — enable encryption at rest and restrict access
- Prefer an external secrets manager where available

```bash
kubectl create configmap app-config --from-file=application.yml
kubectl create secret generic db-cred --from-literal=username=app --from-literal=password='change-me'
kubectl get secret db-cred -o jsonpath='{.data.username}' | base64 -d
```

## Troubleshooting states

- `Pending`: no node fits (resources, taints) — check `describe` events
- `CrashLoopBackOff`: app exits — read `logs --previous`
- `ImagePullBackOff`: wrong image name/tag or registry credentials

```bash
kubectl describe pod <pod> | sed -n '/Events/,$p'
kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[*].state}'
kubectl debug -it <pod> --image=busybox:1.36 --target=app
```

## Manifest snippet

- Run as non-root with a read-only root filesystem
- Liveness restarts, readiness gates traffic
- Pin image tags

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: devtoolkit
spec:
  replicas: 2
  selector:
    matchLabels: { app: devtoolkit }
  template:
    metadata:
      labels: { app: devtoolkit }
    spec:
      securityContext: { runAsNonRoot: true }
      containers:
        - name: app
          image: registry.internal/devtoolkit:1.2.0
          ports: [{ containerPort: 8080 }]
          resources:
            requests: { cpu: 100m, memory: 256Mi }
            limits: { cpu: "1", memory: 1Gi }
          securityContext: { readOnlyRootFilesystem: true, allowPrivilegeEscalation: false }
          readinessProbe: { httpGet: { path: /api/health, port: 8080 } }
          livenessProbe: { httpGet: { path: /api/health, port: 8080 }, initialDelaySeconds: 10 }
```
