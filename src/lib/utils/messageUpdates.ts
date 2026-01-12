import type { MessageFile } from "$lib/types/Message";
import {
	type MessageUpdate,
	type MessageStreamUpdate,
	type MessageToolUpdate,
	type MessageToolCallUpdate,
	type MessageToolResultUpdate,
	type MessageToolErrorUpdate,
	type MessageToolProgressUpdate,
	MessageUpdateType,
	MessageToolUpdateType,
} from "$lib/types/MessageUpdate";

import { page } from "$app/state";
import type { KeyValuePair } from "$lib/types/Tool";

type MessageUpdateRequestOptions = {
	base: string;
	inputs?: string;
	messageId?: string;
	isRetry: boolean;
	isContinue?: boolean;
	files?: MessageFile[];
	// Optional: pass selected MCP server names (client-side selection)
	selectedMcpServerNames?: string[];
	// Optional: pass selected MCP server configs (for custom client-defined servers)
	selectedMcpServers?: Array<{ name: string; url: string; headers?: KeyValuePair[] }>;
};
export async function fetchMessageUpdates(
	conversationId: string,
	opts: MessageUpdateRequestOptions,
	abortSignal: AbortSignal
): Promise<AsyncGenerator<MessageUpdate>> {
	const abortController = new AbortController();
	abortSignal.addEventListener("abort", () => abortController.abort());

	const form = new FormData();

	const optsJSON = JSON.stringify({
		inputs: opts.inputs,
		id: opts.messageId,
		is_retry: opts.isRetry,
		is_continue: Boolean(opts.isContinue),
		// Will be ignored server-side if unsupported
		selectedMcpServerNames: opts.selectedMcpServerNames,
		selectedMcpServers: opts.selectedMcpServers,
	});

	opts.files?.forEach((file) => {
		const name = file.type + ";" + file.name;

		form.append("files", new File([file.value], name, { type: file.mime }));
	});

	form.append("data", optsJSON);

	const response = await fetch(`${opts.base}/conversation/${conversationId}`, {
		method: "POST",
		body: form,
		signal: abortController.signal,
	});

	if (!response.ok) {
		const errorMessage = await response
			.json()
			.then((obj) => obj.message)
			.catch(() => `Request failed with status code ${response.status}: ${response.statusText}`);
		throw Error(errorMessage);
	}
	if (!response.body) {
		throw Error("Body not defined");
	}

	if (!(page.data.publicConfig.PUBLIC_SMOOTH_UPDATES === "true")) {
		return endpointStreamToIterator(response, abortController);
	}

	return smoothAsyncIterator(
		streamMessageUpdatesToFullWords(endpointStreamToIterator(response, abortController))
	);
}

async function* endpointStreamToIterator(
	response: Response,
	abortController: AbortController
): AsyncGenerator<MessageUpdate> {
	const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader();
	if (!reader) throw Error("Response for endpoint had no body");

	// Handle any cases where we must abort
	reader.closed.then(() => abortController.abort());

	// Handle logic for aborting
	abortController.signal.addEventListener("abort", () => reader.cancel());

	// ex) If the last response is => {"type": "stream", "token":
	// It should be => {"type": "stream", "token": "Hello"} = prev_input_chunk + "Hello"}
	let prevChunk = "";
	while (!abortController.signal.aborted) {
		const { done, value } = await reader.read();
		if (done) {
			abortController.abort();
			break;
		}
		if (!value) continue;

		const { messageUpdates, remainingText } = parseMessageUpdates(prevChunk + value);
		prevChunk = remainingText;
		for (const messageUpdate of messageUpdates) yield messageUpdate;
	}
}

function parseMessageUpdates(value: string): {
	messageUpdates: MessageUpdate[];
	remainingText: string;
} {
	const inputs = value.split("\n");
	const messageUpdates: MessageUpdate[] = [];
	for (const input of inputs) {
		try {
			messageUpdates.push(JSON.parse(input) as MessageUpdate);
		} catch (error) {
			// in case of parsing error, we return what we were able to parse
			if (error instanceof SyntaxError) {
				return {
					messageUpdates,
					remainingText: inputs.at(-1) ?? "",
				};
			}
		}
	}
	return { messageUpdates, remainingText: "" };
}

/**
 * Emits all the message updates immediately that aren't "stream" type
 * Emits a concatenated "stream" type message update once it detects a full word
 * Example: "what" " don" "'t" => "what" " don't"
 * Only supports latin languages, ignores others
 */
async function* streamMessageUpdatesToFullWords(
	iterator: AsyncGenerator<MessageUpdate>
): AsyncGenerator<MessageUpdate> {
	let bufferedStreamUpdates: MessageStreamUpdate[] = [];

	const endAlphanumeric = /[a-zA-Z0-9À-ž'`]+$/;
	const beginnningAlphanumeric = /^[a-zA-Z0-9À-ž'`]+/;

	for await (const messageUpdate of iterator) {
		if (messageUpdate.type !== "stream") {
			// When a non-stream update (e.g. tool/status/final answer) arrives,
			// flush any buffered stream tokens so the UI does not appear to
			// "cut" mid-sentence while tools are running.
			if (bufferedStreamUpdates.length > 0) {
				yield {
					type: MessageUpdateType.Stream,
					token: bufferedStreamUpdates.map((u) => u.token).join(""),
				};
				bufferedStreamUpdates = [];
			}
			yield messageUpdate;
			continue;
		}
		bufferedStreamUpdates.push(messageUpdate);

		let lastIndexEmitted = 0;
		for (let i = 1; i < bufferedStreamUpdates.length; i++) {
			const prevEndsAlphanumeric = endAlphanumeric.test(bufferedStreamUpdates[i - 1].token);
			const currBeginsAlphanumeric = beginnningAlphanumeric.test(bufferedStreamUpdates[i].token);
			const shouldCombine = prevEndsAlphanumeric && currBeginsAlphanumeric;
			const combinedTooMany = i - lastIndexEmitted >= 5;
			if (shouldCombine && !combinedTooMany) continue;

			// Combine tokens together and emit
			yield {
				type: MessageUpdateType.Stream,
				token: bufferedStreamUpdates
					.slice(lastIndexEmitted, i)
					.map((_) => _.token)
					.join(""),
			};
			lastIndexEmitted = i;
		}
		bufferedStreamUpdates = bufferedStreamUpdates.slice(lastIndexEmitted);
	}
	for (const messageUpdate of bufferedStreamUpdates) yield messageUpdate;
}

/**
 * Smooth async iterator inspired by lobe-chat's smooth typing effect.
 * Uses frame-based timing with dynamic speed adjustment for a typewriter-like effect.
 *
 * Key features:
 * - Characters are queued and emitted one-by-one for smooth animation
 * - Dynamic speed adjustment: speeds up when queue is long, slows down when short
 * - Non-stream updates (tools, status) are emitted immediately
 * - Uses ~60fps frame timing similar to requestAnimationFrame
 */
async function* smoothAsyncIterator(
	iterator: AsyncGenerator<MessageUpdate>
): AsyncGenerator<MessageUpdate> {
	// Animation configuration
	const FRAME_INTERVAL_MS = 16; // ~60fps, similar to requestAnimationFrame
	const START_ANIMATION_SPEED = 30; // Starting characters per second

	// Event target for signaling new data
	const eventTarget = new EventTarget();

	// State for character queue and animation
	const charQueue: string[] = [];
	const pendingNonStreamUpdates: MessageUpdate[] = [];
	let iteratorDone = false;
	let currentSpeed = START_ANIMATION_SPEED;
	let lastQueueLength = 0;
	let accumulatedTime = 0;
	let lastFrameTime = performance.now();

	// Background task to consume the iterator
	const consumeIterator = (async () => {
		for await (const update of iterator) {
			if (update.type === MessageUpdateType.Stream) {
				// Split token into individual characters for smooth animation
				charQueue.push(...update.token.split(""));
			} else {
				// Non-stream updates are queued separately for immediate emission
				pendingNonStreamUpdates.push(update);
			}
			eventTarget.dispatchEvent(new Event("data"));
		}
		iteratorDone = true;
		eventTarget.dispatchEvent(new Event("done"));
	})();

	// Helper to wait for data or timeout
	const waitForDataOrTimeout = (ms: number) =>
		Promise.race([sleep(ms), waitForEvent(eventTarget, "data"), waitForEvent(eventTarget, "done")]);

	// Main animation loop
	while (!iteratorDone || charQueue.length > 0 || pendingNonStreamUpdates.length > 0) {
		// First, emit any pending non-stream updates immediately
		while (pendingNonStreamUpdates.length > 0) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			yield pendingNonStreamUpdates.shift()!;
		}

		// Process character queue with smooth animation
		if (charQueue.length > 0) {
			const currentTime = performance.now();
			const frameDuration = currentTime - lastFrameTime;
			lastFrameTime = currentTime;
			accumulatedTime += frameDuration;

			// Dynamic speed adjustment (lobe-chat algorithm)
			// Speed up when queue is long, slow down when queue is short
			const targetSpeed = Math.max(START_ANIMATION_SPEED, charQueue.length);
			// Smoother speed change based on queue length changes
			const speedChangeRate = Math.abs(charQueue.length - lastQueueLength) * 0.0008 + 0.005;
			currentSpeed += (targetSpeed - currentSpeed) * speedChangeRate;

			// Calculate characters to process based on accumulated time and current speed
			const charsToProcess = Math.floor((accumulatedTime * currentSpeed) / 1000);

			if (charsToProcess > 0) {
				accumulatedTime -= (charsToProcess * 1000) / currentSpeed;

				const actualChars = Math.min(charsToProcess, charQueue.length);
				const token = charQueue.splice(0, actualChars).join("");

				yield {
					type: MessageUpdateType.Stream,
					token,
				} as MessageUpdate;
			}

			lastQueueLength = charQueue.length;

			// Wait for next frame
			await sleep(FRAME_INTERVAL_MS);
		} else if (!iteratorDone) {
			// Queue is empty but iterator is not done, wait for new data
			await waitForDataOrTimeout(100);
			lastFrameTime = performance.now(); // Reset frame time after waiting
		}
	}

	// Ensure iterator consumption is complete
	await consumeIterator;
}

// Tool update type guards for UI rendering
export const isMessageToolUpdate = (update: MessageUpdate): update is MessageToolUpdate =>
	update.type === MessageUpdateType.Tool;

export const isMessageToolCallUpdate = (update: MessageUpdate): update is MessageToolCallUpdate =>
	isMessageToolUpdate(update) && update.subtype === MessageToolUpdateType.Call;

export const isMessageToolResultUpdate = (
	update: MessageUpdate
): update is MessageToolResultUpdate =>
	isMessageToolUpdate(update) && update.subtype === MessageToolUpdateType.Result;

export const isMessageToolErrorUpdate = (update: MessageUpdate): update is MessageToolErrorUpdate =>
	isMessageToolUpdate(update) && update.subtype === MessageToolUpdateType.Error;

export const isMessageToolProgressUpdate = (
	update: MessageUpdate
): update is MessageToolProgressUpdate =>
	isMessageToolUpdate(update) && update.subtype === MessageToolUpdateType.Progress;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitForEvent = (eventTarget: EventTarget, eventName: string) =>
	new Promise<boolean>((resolve) =>
		eventTarget.addEventListener(eventName, () => resolve(true), { once: true })
	);
