import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Quick manual account selection for pi-multi-account provider slots.
 * pi-multi-account remains responsible for OAuth, quota tracking and failover.
 */
export default function (pi: ExtensionAPI) {
	const isAccountProvider = (provider: string) =>
		provider === "anthropic" ||
		provider === "openai-codex" ||
		provider === "kimi-coding" ||
		provider === "cursor" ||
		provider === "qwen" ||
		provider === "ollama" ||
		/-account-\d+$/i.test(provider);

	function updateStatus(ctx: any) {
		const model = ctx.model;
		if (!model) {
			ctx.ui.setStatus("active-account", undefined);
			return;
		}
		ctx.ui.setStatus("active-account", `Account: ${model.provider}`);
	}

	function accountModels(ctx: any) {
		return ctx.modelRegistry
			.getAvailable()
			.filter((model: any) => isAccountProvider(model.provider));
	}

	async function switchTo(ctx: any, provider: string) {
		if (!ctx.isIdle()) {
			ctx.ui.notify("Finish or cancel the current turn before switching accounts.", "warning");
			return;
		}

		const models = accountModels(ctx);
		// Keep the same model whenever the target account provides it; otherwise use its first model.
		const target =
			models.find((model: any) => model.provider === provider && model.id === ctx.model?.id) ??
			models.find((model: any) => model.provider === provider);
		if (!target) {
			ctx.ui.notify(`No available model for account ${provider}.`, "warning");
			return;
		}
		if (target.provider === ctx.model?.provider && target.id === ctx.model?.id) {
			ctx.ui.notify(`Already using ${provider}.`, "info");
			return;
		}
		if (await pi.setModel(target)) {
			// model_select can fire before ctx.model is updated, so show the selected slot directly.
			ctx.ui.setStatus("active-account", `Account: ${target.provider}`);
			ctx.ui.notify(`Switched account: ${target.provider}/${target.id}`, "info");
		} else {
			ctx.ui.notify(`Could not authenticate account ${provider}.`, "error");
		}
	}

	async function pickAccount(ctx: any) {
		if (!ctx.isIdle()) {
			ctx.ui.notify("Finish or cancel the current turn before switching accounts.", "warning");
			return;
		}
		const providers = [...new Set(accountModels(ctx).map((model: any) => model.provider))].sort();
		if (providers.length === 0) {
			ctx.ui.notify("No pi-multi-account provider slots are available. Run /multi-account rediscover.", "warning");
			return;
		}
		const choice = await ctx.ui.select("Select account", providers);
		if (choice) await switchTo(ctx, choice);
	}

	async function cycleAccount(ctx: any, direction: 1 | -1) {
		const providers = [...new Set(accountModels(ctx).map((model: any) => model.provider))].sort();
		if (providers.length === 0) return;
		const current = providers.indexOf(ctx.model?.provider);
		const next = providers[(Math.max(current, 0) + direction + providers.length) % providers.length];
		await switchTo(ctx, next);
	}

	pi.registerCommand("account", {
		description: "Select a pi-multi-account account slot",
		handler: async (_args, ctx) => pickAccount(ctx),
	});
	pi.registerShortcut("ctrl+alt+a", {
		description: "Select account",
		handler: async (ctx) => pickAccount(ctx),
	});
	pi.registerShortcut("ctrl+alt+right", {
		description: "Next account",
		handler: async (ctx) => cycleAccount(ctx, 1),
	});
	pi.registerShortcut("ctrl+alt+left", {
		description: "Previous account",
		handler: async (ctx) => cycleAccount(ctx, -1),
	});

	pi.on("session_start", (_event, ctx) => updateStatus(ctx));
	pi.on("model_select", (_event, ctx) => {
		// Pi emits this event before it replaces ctx.model.
		setTimeout(() => updateStatus(ctx), 0);
	});
}
