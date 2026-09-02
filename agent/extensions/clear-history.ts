import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";

type ComponentContainer = Component & {
	children: Component[];
	clear(): void;
};

function isComponentContainer(component: Component | undefined): component is ComponentContainer {
	if (!component || typeof component !== "object") return false;
	const candidate = component as Partial<ComponentContainer>;
	return Array.isArray(candidate.children) && typeof candidate.clear === "function";
}

/**
 * Clear only pi's rendered chat container. Session entries and model context
 * remain untouched, so the conversation continues normally.
 */
export function clearVisualTranscript(tui: TUI): void {
	// InteractiveMode mounts the document container first. Its children are:
	// header, loaded resources, and chat transcript.
	const documentContainer = tui.children[0];
	if (!isComponentContainer(documentContainer)) {
		throw new Error("Could not locate pi's document container");
	}

	const chatContainer = documentContainer.children[2];
	if (!isComponentContainer(chatContainer)) {
		throw new Error("Could not locate pi's chat container");
	}

	chatContainer.clear();
	// Force a full redraw so the old transcript is also removed from terminal
	// scrollback in regular mode.
	tui.requestRender(true);
}

export default function clearHistoryExtension(pi: ExtensionAPI) {
	pi.registerCommand("clear", {
		description: "Visually clear message history without changing session context",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/clear is available only in interactive TUI mode", "warning");
				return;
			}

			await ctx.waitForIdle();
			await ctx.ui.custom<void>((tui, _theme, _keybindings, done) => {
				clearVisualTranscript(tui);
				done();
				return {
					render: () => [],
					invalidate() {},
				};
			});

			ctx.ui.notify("Visual message history cleared", "info");
		},
	});
}
