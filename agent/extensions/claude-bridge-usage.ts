/**
 * Claude Bridge Usage
 *
 * pi-multi-account only reports usage for the *active model's* provider family
 * (anthropic, openai-codex, cursor, kimi-coding, qwen, ollama). It has no
 * concept of `claude-bridge` (pi-claude-bridge), even though claude-bridge
 * draws from the exact same Anthropic subscription quota as a native
 * `anthropic`/`anthropic-account-N` login.
 *
 * This extension reads whichever `anthropic*` OAuth credential is stored in
 * pi's auth.json (managed/refreshed by pi-multi-account) and polls Anthropic's
 * own `/api/oauth/usage` endpoint directly, showing the result in the footer
 * and via a `/claude-usage` command whenever the active model is claude-bridge.
 *
 * Config (optional): ~/.pi/agent/claude-bridge-usage.json
 *   { "accountId": "anthropic-account-2" }
 * Defaults to the first usable anthropic* entry in auth.json when unset.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AGENT_DIR = join(homedir(), ".pi", "agent");
const AUTH_PATH = join(AGENT_DIR, "auth.json");
const CONFIG_PATH = join(AGENT_DIR, "claude-bridge-usage.json");
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const REFRESH_MS = 5 * 60 * 1000;

// Claude/Anthropic brand orange (#d97757) as a truecolor ANSI escape.
const claudeOrange = (text: string) => `\x1b[38;2;217;119;87m${text}\x1b[0m`;

interface AuthEntry {
	type?: string;
	access?: string;
}

interface UsageSnapshot {
	fiveHourPct: number;
	fiveHourResetAt?: string;
	sevenDayPct: number;
	sevenDayResetAt?: string;
	fetchedAt: number;
}

function readJson(path: string): any | undefined {
	try {
		if (!existsSync(path)) return undefined;
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

function pickAccountId(): string | undefined {
	const config = readJson(CONFIG_PATH);
	if (config?.accountId) return config.accountId;
	const auth = readJson(AUTH_PATH) ?? {};
	const candidates = Object.keys(auth)
		.filter((key) => key === "anthropic" || /^anthropic-account-\d+$/.test(key))
		.sort();
	return candidates[0];
}

function readAccessToken(accountId: string): string | undefined {
	const auth = readJson(AUTH_PATH) ?? {};
	const entry: AuthEntry | undefined = auth[accountId];
	return entry?.type === "oauth" ? entry.access : undefined;
}

function formatReset(iso?: string): string {
	if (!iso) return "?";
	const ms = Date.parse(iso);
	if (!Number.isFinite(ms)) return "?";
	const diffMin = Math.max(0, Math.round((ms - Date.now()) / 60000));
	if (diffMin < 60) return `${diffMin}m`;
	const h = Math.floor(diffMin / 60);
	const m = diffMin % 60;
	return `${h}h${m ? `${m}m` : ""}`;
}

async function fetchUsage(accountId: string): Promise<UsageSnapshot | { error: string }> {
	const token = readAccessToken(accountId);
	if (!token) return { error: `no OAuth token stored for ${accountId}` };
	let response: Response;
	try {
		response = await fetch(USAGE_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
			},
		});
	} catch (err) {
		return { error: `network error: ${(err as Error).message}` };
	}
	if (!response.ok) {
		return { error: `HTTP ${response.status} — try "/multi-account accounts refresh" to refresh the token` };
	}
	const body = await response.json().catch(() => undefined);
	const fiveHour = body?.five_hour;
	const sevenDay = body?.seven_day;
	if (!fiveHour && !sevenDay) return { error: "unexpected response shape from Anthropic usage endpoint" };
	return {
		fiveHourPct: Math.round(fiveHour?.utilization ?? 0),
		fiveHourResetAt: fiveHour?.resets_at,
		sevenDayPct: Math.round(sevenDay?.utilization ?? 0),
		sevenDayResetAt: sevenDay?.resets_at,
		fetchedAt: Date.now(),
	};
}

export default function (pi: ExtensionAPI) {
	let lastSnapshot: UsageSnapshot | undefined;
	let lastError: string | undefined;
	let timer: ReturnType<typeof setInterval> | undefined;

	const isClaudeBridge = (ctx: any) => ctx.model?.provider === "claude-bridge";

	function clearStatus(ctx: any) {
		ctx.ui.setStatus("claude-bridge-usage", undefined);
	}

	function renderStatus(ctx: any) {
		if (!isClaudeBridge(ctx)) {
			clearStatus(ctx);
			return;
		}
		if (lastSnapshot) {
			ctx.ui.setStatus(
				"claude-bridge-usage",
				claudeOrange(`Claude 5h ${lastSnapshot.fiveHourPct}% · 7d ${lastSnapshot.sevenDayPct}%`),
			);
		} else if (lastError) {
			ctx.ui.setStatus("claude-bridge-usage", `Claude usage: ${lastError}`);
		}
	}

	async function refresh(ctx: any, notifyResult: boolean) {
		const accountId = pickAccountId();
		if (!accountId) {
			lastError = "no anthropic* account in auth.json — run /login → Use a subscription → Anthropic";
			lastSnapshot = undefined;
			if (notifyResult) ctx.ui.notify(`claude-bridge-usage: ${lastError}`, "warning");
			renderStatus(ctx);
			return;
		}
		const result = await fetchUsage(accountId);
		if ("error" in result) {
			lastError = result.error;
			if (notifyResult) ctx.ui.notify(`claude-bridge-usage (${accountId}): ${lastError}`, "warning");
		} else {
			lastSnapshot = result;
			lastError = undefined;
			if (notifyResult) {
				ctx.ui.notify(
					`Claude usage (${accountId}) — session: ${result.fiveHourPct}% (resets in ${formatReset(result.fiveHourResetAt)}) · weekly: ${result.sevenDayPct}% (resets in ${formatReset(result.sevenDayResetAt)})`,
					"info",
				);
			}
		}
		renderStatus(ctx);
	}

	pi.registerCommand("claude-usage", {
		description: "Show current Claude subscription usage (works while on claude-bridge)",
		handler: async (_args, ctx) => refresh(ctx, true),
	});

	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		refresh(ctx, false);
		timer = setInterval(() => refresh(ctx, false), REFRESH_MS);
	});

	pi.on("model_select", (_event, ctx) => {
		setTimeout(() => renderStatus(ctx), 0);
	});
}
