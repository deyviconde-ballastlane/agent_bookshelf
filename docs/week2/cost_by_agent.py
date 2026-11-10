"""Sum token usage per agent from a Claude Code session log and price it.

Usage: python3 cost_by_agent.py <session.jsonl> [<session.jsonl> ...]
Prices: USD per million tokens, from the week 2 slides (pricing page, 27 Oct 2026).
"""
import json
import sys
from pathlib import Path

PRICES = {  # input, output, 5m write, 1h write, cache hit
    "opus": (4, 20, 5, 8, 0.20),
    "sonnet": (2, 10, 2.50, 4, 0.10),
    "haiku": (0.10, 0.50, 0.125, 0.20, 0.01),
}


def family(model):
    for name in PRICES:
        if name in model:
            return name
    return None


def sum_log(path):
    seen = set()
    tot = {"model": set(), "in": 0, "out": 0, "w5": 0, "w1h": 0, "read": 0, "req": 0, "cost": 0.0}
    for line in path.open():
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = rec.get("message") or {}
        usage = msg.get("usage")
        if rec.get("type") != "assistant" or not usage:
            continue
        key = (msg.get("id"), rec.get("requestId"))
        if key in seen:
            continue
        seen.add(key)
        fam = family(msg.get("model", ""))
        if fam is None:
            continue
        cc = usage.get("cache_creation") or {}
        w5 = cc.get("ephemeral_5m_input_tokens", 0)
        w1h = cc.get("ephemeral_1h_input_tokens", 0)
        if not cc:
            w5 = usage.get("cache_creation_input_tokens", 0)
        p_in, p_out, p_w5, p_w1h, p_read = PRICES[fam]
        tot["model"].add(fam)
        tot["in"] += usage.get("input_tokens", 0)
        tot["out"] += usage.get("output_tokens", 0)
        tot["w5"] += w5
        tot["w1h"] += w1h
        tot["read"] += usage.get("cache_read_input_tokens", 0)
        tot["req"] += 1
        tot["cost"] += (
            usage.get("input_tokens", 0) * p_in
            + usage.get("output_tokens", 0) * p_out
            + w5 * p_w5
            + w1h * p_w1h
            + usage.get("cache_read_input_tokens", 0) * p_read
        ) / 1e6
    return tot


def report(session):
    session = Path(session)
    rows = [("orchestrator (main)", sum_log(session))]
    sub_dir = session.with_suffix("") / "subagents"
    for log in sorted(sub_dir.glob("agent-*.jsonl")):
        meta = json.loads(log.with_suffix(".meta.json").read_text())
        rows.append((meta.get("agentType", log.stem), sum_log(log)))
    print(f"\n{session.name}")
    print("| agent | model | requests | output | cache read | cache write | cost |")
    print("|---|---|---|---|---|---|---|")
    total = 0.0
    for name, t in rows:
        total += t["cost"]
        print(
            f"| {name} | {', '.join(sorted(t['model']))} | {t['req']} | {t['out']/1e3:.1f}k "
            f"| {t['read']/1e3:.1f}k | {(t['w5'] + t['w1h'])/1e3:.1f}k | ${t['cost']:.2f} |"
        )
    print(f"| **total** | | | | | | **${total:.2f}** |")


for arg in sys.argv[1:]:
    report(arg)
