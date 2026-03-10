#!/usr/bin/env node

const net = require("net");
const http = require("http");
const https = require("https");
const dgram = require("dgram");
const dns = require("dns");
const { spawn } = require("child_process");

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
  brightGreen:   "\x1b[92m",
  brightYellow:  "\x1b[93m",
  brightBlue:    "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan:    "\x1b[96m",
  brightWhite:   "\x1b[97m",
};

const PROTO_COLOR = {
  tcp:   C.brightBlue,
  http:  C.brightCyan,
  https: C.brightMagenta,
  udp:   C.brightYellow,
  icmp:  C.yellow,
  dns:   C.brightGreen,
};

function msColor(ms) {
  const n = parseFloat(ms);
  if (n <  20) return C.brightGreen;
  if (n <  80) return C.yellow;
  if (n < 250) return C.yellow + C.bold;
  return C.red;
}

function latBar(ms, maxMs) {
  const bars = "▏▎▍▌▋▊▉█";
  const filled = Math.round(Math.min((ms / Math.max(maxMs, 1)) * 20, 20));
  const bar = "█".repeat(filled).padEnd(20, "░");
  return C.gray + bar + C.reset;
}

function pingTcp(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.connect(port, host, () => {
      const ms = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(2);
      sock.destroy();
      resolve({ success: true, ms });
    });
    sock.on("timeout", () => { sock.destroy(); resolve({ success: false, reason: "Connection timed out" }); });
    sock.on("error", (e) => {
      sock.destroy();
      const map = { ECONNREFUSED: "Connection refused", EHOSTUNREACH: "Host unreachable", ENOTFOUND: "Host not found", ENETUNREACH: "Network unreachable" };
      resolve({ success: false, reason: map[e.code] || e.message });
    });
  });
}

function pingHttp(host, port, useHttps, timeout = 5000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const proto = useHttps ? https : http;
    const req = proto.request({ host, port: port || (useHttps ? 443 : 80), method: "HEAD", path: "/", timeout }, (res) => {
      const ms = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(2);
      res.resume();
      resolve({ success: true, ms, extra: `HTTP ${res.statusCode}` });
    });
    req.on("timeout", () => { req.destroy(); resolve({ success: false, reason: "Connection timed out" }); });
    req.on("error", (e) => {
      const map = { ECONNREFUSED: "Connection refused", ENOTFOUND: "Host not found" };
      resolve({ success: false, reason: map[e.code] || e.message });
    });
    req.end();
  });
}

function pingUdp(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const client = dgram.createSocket("udp4");
    const msg = Buffer.alloc(8, 0);
    let done = false;
    const finish = (r) => { if (done) return; done = true; try { client.close(); } catch(_){} resolve(r); };
    setTimeout(() => finish({ success: false, reason: "Connection timed out" }), timeout);
    client.on("message", () => {
      const ms = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(2);
      finish({ success: true, ms });
    });
    client.on("error", (e) => {
      finish({ success: false, reason: e.code === "ECONNREFUSED" ? "Port closed (ICMP unreachable)" : e.message });
    });
    client.send(msg, 0, msg.length, port, host, (e) => { if (e) finish({ success: false, reason: e.message }); });
  });
}

function pingIcmp(host, timeout = 4000) {
  return new Promise((resolve) => {
    const isWin = process.platform === "win32";
    const args  = isWin
      ? ["-n", "1", "-w", String(timeout), host]
      : ["-c", "1", "-W", String(Math.ceil(timeout / 1000)), host];
    const proc = spawn("ping", args);
    let out = "";
    proc.stdout.on("data", d => out += d);
    proc.stderr.on("data", d => out += d);
    const kill = setTimeout(() => { try { proc.kill(); } catch(_){} }, timeout + 1000);
    proc.on("close", (code) => {
      clearTimeout(kill);
      if (code !== 0) return resolve({ success: false, reason: "Request timeout / host unreachable" });
      const m = out.match(/time[<=]([\d.]+)\s*ms/i) || out.match(/Average\s*=\s*([\d.]+)\s*ms/i);
      resolve({ success: true, ms: m ? parseFloat(m[1]).toFixed(2) : "?" });
    });
  });
}

function pingDns(host, timeout = 4000) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const t = setTimeout(() => resolve({ success: false, reason: "DNS timeout" }), timeout);
    dns.resolve(host, (err, addrs) => {
      clearTimeout(t);
      const ms = (Number(process.hrtime.bigint() - start) / 1e6).toFixed(2);
      if (err) return resolve({ success: false, reason: `DNS error: ${err.code}` });
      resolve({ success: true, ms, extra: addrs[0] });
    });
  });
}

async function runPing(protocol, host, port, timeout) {
  switch (protocol) {
    case "tcp":   return pingTcp(host, parseInt(port) || 80, timeout);
    case "http":  return pingHttp(host, parseInt(port) || 80,  false, timeout);
    case "https": return pingHttp(host, parseInt(port) || 443, true,  timeout);
    case "udp":   return pingUdp(host, parseInt(port) || 53, timeout);
    case "icmp":  return pingIcmp(host, timeout);
    case "dns":   return pingDns(host, timeout);
    default:      return { success: false, reason: `Unknown protocol: ${protocol}` };
  }
}

function printStats(stats, host) {
  const loss = stats.sent > 0 ? ((stats.fail / stats.sent) * 100).toFixed(1) : "0.0";
  const avg  = stats.ok > 0 ? (stats.sumMs / stats.ok).toFixed(2) : "—";
  const min  = stats.minMs === Infinity ? "—" : stats.minMs.toFixed(2) + " ms";
  const max  = stats.maxMs === 0 ? "—" : stats.maxMs.toFixed(2) + " ms";

  process.stdout.write("\n");
  console.log(C.gray + "─".repeat(60) + C.reset);
  console.log(C.bold + C.white + `Ping statistics for ${host}` + C.reset);
  console.log(
    `  Packets: Sent=${C.white}${stats.sent}${C.reset}` +
    `, Received=${C.brightGreen}${stats.ok}${C.reset}` +
    `, Lost=${stats.fail > 0 ? C.red : C.gray}${stats.fail}${C.reset}` +
    ` (${stats.fail > 0 ? C.red : C.gray}${loss}% loss${C.reset})`
  );
  if (stats.ok > 0) {
    console.log(`  Round-trip: min=${C.brightGreen}${min}${C.reset}, avg=${C.cyan}${avg} ms${C.reset}, max=${C.yellow}${max}${C.reset}`);
  }
  console.log(C.gray + "─".repeat(60) + C.reset);
}

function printHelp() {
  console.log(`
${C.bold}${C.brightCyan}paping${C.reset} — multi-protocol pinger

${C.bold}Usage:${C.reset}
  node pinger.js ${C.yellow}<host>${C.reset} [options]

${C.bold}Options:${C.reset}
  ${C.green}-p, --port      <port>${C.reset}       Port number (default: 80)
  ${C.green}-P, --protocol  <proto>${C.reset}      Protocol: tcp http https udp icmp dns (default: tcp)
  ${C.green}-c, --count     <n>${C.reset}          Stop after N pings (default: ∞)
  ${C.green}-i, --interval  <ms>${C.reset}         Interval between pings in ms (default: 1000)
  ${C.green}-t, --timeout   <ms>${C.reset}         Timeout per ping in ms (default: 4000)
  ${C.green}-b, --bar${C.reset}                    Show latency bar
  ${C.green}-h, --help${C.reset}                   Show this help

${C.bold}Examples:${C.reset}
  ${C.gray}node pinger.js 1.1.1.1${C.reset}
  ${C.gray}node pinger.js google.com -P https -p 443${C.reset}
  ${C.gray}node pinger.js 8.8.8.8 -P dns -c 5${C.reset}
  ${C.gray}node pinger.js 192.168.1.1 -P icmp${C.reset}
  ${C.gray}node pinger.js example.com -P tcp -p 22 -i 500 -b${C.reset}

${C.bold}Protocols:${C.reset}
  ${C.brightBlue}tcp${C.reset}    Raw socket connect timing
  ${C.brightCyan}http${C.reset}   HTTP HEAD request (TTFB)
  ${C.brightMagenta}https${C.reset}  HTTPS HEAD request (includes TLS)
  ${C.brightYellow}udp${C.reset}    UDP datagram probe
  ${C.yellow}icmp${C.reset}   System ping (ICMP echo)
  ${C.brightGreen}dns${C.reset}    DNS resolution timing
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    host:     null,
    port:     null,
    protocol: "tcp",
    count:    Infinity,
    interval: 1000,
    timeout:  4000,
    bar:      false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help")     { printHelp(); process.exit(0); }
    else if (a === "-b" || a === "--bar") { opts.bar = true; }
    else if ((a === "-p" || a === "--port")     && args[i+1]) { opts.port     = args[++i]; }
    else if ((a === "-P" || a === "--protocol") && args[i+1]) { opts.protocol = args[++i].toLowerCase(); }
    else if ((a === "-c" || a === "--count")    && args[i+1]) { opts.count    = parseInt(args[++i]); }
    else if ((a === "-i" || a === "--interval") && args[i+1]) { opts.interval = parseInt(args[++i]); }
    else if ((a === "-t" || a === "--timeout")  && args[i+1]) { opts.timeout  = parseInt(args[++i]); }
    else if (!a.startsWith("-"))                               { opts.host     = a; }
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.host) {
    console.error(C.red + "Error: host is required." + C.reset);
    printHelp();
    process.exit(1);
  }

  const { host, protocol, port, count, interval, timeout, bar } = opts;
  const protoCls = PROTO_COLOR[protocol] || C.white;
  const displayPort = port || { tcp:"80", http:"80", https:"443", udp:"53", icmp:"—", dns:"—" }[protocol];

  console.log("");
  console.log(
    `${C.bold}${C.white}paping${C.reset} — ` +
    `pinging ${C.bold}${C.brightBlue}${host}${C.reset}` +
    (displayPort !== "—" ? ` on port ${C.orange || C.yellow}${displayPort}${C.reset}` : "") +
    ` using ${protoCls}${protocol.toUpperCase()}${C.reset}`
  );
  console.log(C.gray + "─".repeat(60) + C.reset);

  const stats = { sent: 0, ok: 0, fail: 0, minMs: Infinity, maxMs: 0, sumMs: 0 };
  let seq = 0;

  process.on("SIGINT", () => {
    printStats(stats, host);
    process.exit(0);
  });

  const loop = async () => {
    if (seq >= count) {
      printStats(stats, host);
      process.exit(0);
    }

    seq++;
    const result = await runPing(protocol, host, port, timeout);
    stats.sent++;

    if (result.success) {
      const ms  = parseFloat(result.ms);
      stats.ok++;
      stats.sumMs += ms;
      stats.minMs  = Math.min(stats.minMs, ms);
      stats.maxMs  = Math.max(stats.maxMs, ms);

      const msCls   = msColor(ms);
      const barStr  = bar ? " " + latBar(ms, stats.maxMs) : "";
      const extra   = result.extra ? C.gray + ` (${result.extra})` + C.reset : "";

      console.log(
        `${C.brightGreen}connected to${C.reset} ` +
        `${C.brightBlue}${host}${C.reset}` +
        `  time=${msCls}${result.ms} ms${C.reset}` +
        `  protocol=${protoCls}${protocol}${C.reset}` +
        (displayPort !== "—" ? `  port=${C.yellow}${displayPort}${C.reset}` : "") +
        barStr + extra
      );
    } else {
      stats.fail++;
      console.log(`${C.red}${result.reason || "Connection timed out"}${C.reset}`);
    }

    if (seq < count) {
      setTimeout(loop, interval);
    } else {
      printStats(stats, host);
      process.exit(0);
    }
  };

  loop();
}

main().catch((e) => {
  console.error(C.red + e.message + C.reset);
  process.exit(1);
});
