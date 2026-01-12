/**
 * Generates a favicon URL for the given server URL
 * @param serverUrl - The MCP server URL (e.g., "https://mcp.exa.ai/mcp")
 * @returns The favicon URL from the server's root domain
 */
export function getMcpServerFaviconUrl(serverUrl: string): string {
	try {
		const parsed = new URL(serverUrl);
		// Directly fetch favicon from the target server's /favicon.ico endpoint
		return `${parsed.protocol}//${parsed.hostname}/favicon.ico`;
	} catch {
		// If URL parsing fails, return empty string (will show default icon)
		return "";
	}
}
