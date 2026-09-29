# Z407 controller

Standalone static Bluetooth controller for Bluefy. No OpenAI services, backend, API keys, or paid hosting are required.

## Publish free with GitHub Pages

1. Create a public repository called z407-controller.
2. Upload this folder’s contents to the repository.
3. Open Settings → Pages. Choose Deploy from a branch, main, /docs, then Save.
4. Open the published HTTPS address in Bluefy. Select your speaker and save your counts.
5. Copy the two NFC links from the new page into your Shortcuts automations.

The original hosted sites remain unchanged. Bluetooth permissions and saved counts are local to each website address.

Default bass counts: up 12, down 13.

Tests: node --test tests/*.mjs
