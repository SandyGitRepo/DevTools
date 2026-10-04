---
title: Linux / Bash
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Bash 5.2 · GNU coreutils 9
tags: [linux, shell, ops]
sources: [gnu.org/software/bash/manual, man7.org]
---

Shell commands for navigating servers, reading logs and writing safe scripts.

## Files and directories

- `ls -lah` shows hidden files with human sizes
- `cp -a` preserves permissions and timestamps
- `rm -i` asks before deleting; there is no recycle bin

```bash
ls -lah /var/log
mkdir -p releases/2026-10
cp -a config.yml config.yml.bak
mv old-name.txt new-name.txt
du -sh * | sort -h
df -h
```

## Find and search

- `find` locates files by name, size or age
- `grep -rn` searches recursively with line numbers
- `ripgrep` (`rg`) is faster if installed

```bash
find /var/log -name "*.log" -mtime -1 -size +10M
grep -rn "LoanException" --include="*.log" /var/log/app
grep -c "HTTP/1.1\" 500" access.log
zgrep "ERROR" app.log.1.gz
```

## Viewing logs

- `tail -f` follows a file; `less +F` follows and lets you scroll
- `journalctl` reads systemd service logs
- Pipe through `grep`, `awk`, `sort | uniq -c` for quick stats

```bash
tail -f -n 200 /var/log/app/app.log
less +F /var/log/app/app.log
journalctl -u devtoolkit --since "1 hour ago"
awk '{print $9}' access.log | sort | uniq -c | sort -rn | head
```

## Permissions

- `rwx` for user / group / others; numeric 7 = rwx, 6 = rw-, 4 = r--
- Keys and secrets should be `600` (owner read/write only)
- `chown user:group` changes ownership

```bash
chmod 600 ~/.ssh/id_ed25519
chmod 755 deploy.sh
chown -R app:app /opt/devtoolkit
ls -l deploy.sh             # -rwxr-xr-x
```

## Processes

- `ps aux` lists processes; `top`/`htop` show live usage
- `kill` sends SIGTERM (graceful); `kill -9` only as a last resort
- `ss -tlnp` shows listening ports and owners

```bash
ps aux | grep java
top -o %MEM
kill 12345
ss -tlnp | grep 8080
nohup ./job.sh > job.log 2>&1 &
```

## Networking

- `curl -v` shows request and response headers
- `nc -zv` checks whether a port is reachable
- `dig` resolves DNS names

```bash
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" https://intranet.example/health
curl -sI https://intranet.example
nc -zv db.internal 5432
dig +short api.internal
```

## Archives

- `tar` with `z` (gzip) or `J` (xz); `-C` sets the target directory
- `zip -r` / `unzip -l` for Windows-friendly archives
- `sha256sum` verifies downloads

```bash
tar -czf logs-2026-10-04.tar.gz /var/log/app
tar -xzf release.tar.gz -C /opt/devtoolkit
unzip -l devtoolkit-0.1.0.zip
sha256sum devtoolkit-0.1.0.zip
```

## Safe scripts

- Start scripts with `set -euo pipefail` to stop on errors
- Quote variables: `"$file"` — unquoted variables split on spaces
- Use `$(…)` for command substitution and `[[ … ]]` for tests

```bash
#!/usr/bin/env bash
set -euo pipefail

backup_dir="/backups/$(date +%F)"
mkdir -p "$backup_dir"

for file in /etc/app/*.yml; do
  [[ -f "$file" ]] || continue
  cp -a "$file" "$backup_dir/"
done
echo "Backed up to $backup_dir"
```

## Text processing

- `cut`, `sort`, `uniq`, `wc` for quick column work
- `sed -i` edits in place — keep a backup with `-i.bak`
- `jq` slices JSON

```bash
cut -d, -f1,3 loans.csv | sort | uniq | wc -l
sed -i.bak 's/old-host/new-host/g' app.properties
jq '.items[] | {id, amount}' statement.json
xargs -n1 -I{} echo "processing {}" < ids.txt
```
