# 🔌 Knockd

> Multi-protocol network pinger for the command line

**Knockd** è un tool da riga di comando scritto in Node.js che misura la latenza di rete su 6 protocolli diversi: TCP, HTTP, HTTPS, UDP, ICMP e DNS. Zero dipendenze esterne.

---

## Indice

- [Requisiti](#requisiti)
- [Installazione](#installazione)
- [Utilizzo](#utilizzo)
- [Opzioni](#opzioni)
- [Protocolli](#protocolli)
- [Esempi](#esempi)
- [Output](#output)
- [Licenza](#licenza)

---

## Requisiti

- [Node.js](https://nodejs.org/) v14 o superiore
- Nessuna dipendenza npm

---

## Installazione

```bash
# Clona o scarica il file
git clone https://github.com/tuo-utente/knockd.git
cd knockd

# Nessun npm install necessario — zero dipendenze
```

Oppure usa direttamente il file singolo:

```bash
node pinger.js --help
```

### Opzionale — rendi il comando globale

**Linux / macOS:**
```bash
chmod +x pinger.js
sudo ln -s $(pwd)/pinger.js /usr/local/bin/knockd
# da ora in poi:
knockd 1.1.1.1
```

**Windows (PowerShell):**
```powershell
# Aggiungi la cartella al PATH oppure crea un alias
Set-Alias knockd "node C:\percorso\pinger.js"
```

---

## Utilizzo

```
node pinger.js <host> [opzioni]
```

```
knockd <host> [opzioni]          # se installato globalmente
```

---

## Opzioni

| Flag | Esteso | Descrizione | Default |
|------|--------|-------------|---------|
| `-p` | `--port <n>` | Numero di porta | `80` |
| `-P` | `--protocol <proto>` | Protocollo da usare | `tcp` |
| `-c` | `--count <n>` | Ferma dopo N ping | `∞` |
| `-i` | `--interval <ms>` | Intervallo tra i ping in ms | `1000` |
| `-t` | `--timeout <ms>` | Timeout per ogni ping in ms | `4000` |
| `-b` | `--bar` | Mostra barra grafica della latenza | off |
| `-h` | `--help` | Mostra l'aiuto | — |

---

## Protocolli

| Protocollo | Flag | Cosa misura | Porta default |
|------------|------|-------------|---------------|
| **TCP** | `-P tcp` | Tempo di connessione socket raw | 80 |
| **HTTP** | `-P http` | Time-to-first-byte di una richiesta HEAD | 80 |
| **HTTPS** | `-P https` | Come HTTP, include handshake TLS | 443 |
| **UDP** | `-P udp` | Round-trip di un datagramma UDP | 53 |
| **ICMP** | `-P icmp` | Echo ICMP tramite il `ping` di sistema | — |
| **DNS** | `-P dns` | Tempo di risoluzione del nome host | — |

> **Nota UDP:** molti host non rispondono ai datagrammi UDP generici. Il timeout è atteso a meno che non ci sia un servizio UDP attivo sulla porta indicata (es. DNS su 53).

---

## Esempi

```bash
# TCP ping base (default)
node pinger.js 1.1.1.1

# Ping HTTPS verso Google
node pinger.js google.com -P https -p 443

# ICMP (ping classico)
node pinger.js 8.8.8.8 -P icmp

# Misura la risoluzione DNS
node pinger.js cloudflare.com -P dns

# Probe UDP su porta 53
node pinger.js 8.8.8.8 -P udp -p 53

# TCP veloce con barra latenza, intervallo 500ms
node pinger.js 1.1.1.1 -b -i 500

# Ferma dopo 10 ping
node pinger.js example.com -c 10

# Ping SSH su porta 22
node pinger.js 192.168.1.1 -P tcp -p 22

# Timeout personalizzato (2 secondi)
node pinger.js lentissimo.it -P http -t 2000
```

---

## Output

### Connessione riuscita

```
connected to  1.1.1.1   time=13.28 ms   protocol=tcp   port=80
connected to  1.1.1.1   time=11.45 ms   protocol=tcp   port=80
connected to  1.1.1.1   time=9.98 ms    protocol=tcp   port=80
```

### Connessione fallita

```
Connection timed out
Connection refused
Host not found
```

### Statistiche finali (Ctrl+C o fine conteggio)

```
────────────────────────────────────────────────────────────
Ping statistics for 1.1.1.1
  Packets: Sent=10, Received=9, Lost=1 (10% loss)
  Round-trip: min=9.98ms, avg=12.43ms, max=18.88ms
────────────────────────────────────────────────────────────
```

### Con barra latenza (`-b`)

```
connected to  1.1.1.1   time=13.28 ms   protocol=tcp   ████░░░░░░░░░░░░░░░░
connected to  1.1.1.1   time=31.50 ms   protocol=tcp   █████████░░░░░░░░░░░
```

---

### Colorazione latenza

| Colore | Latenza |
|--------|---------|
| 🟢 Verde | < 20 ms |
| 🟡 Giallo | 20–80 ms |
| 🟠 Arancione | 80–250 ms |
| 🔴 Rosso | > 250 ms |

---

## Licenza

MIT © 2025 — libero di usare, modificare e distribuire con l'unico obbligo di mantenere il copyright originale.

```
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```
