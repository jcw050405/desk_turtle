<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/672d2081-dea7-4686-8600-d6ddea722145

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## MVP-1 Test Notes

- Core posture tracking runs locally in the Electron desktop app.
- Supabase ranking and friend/group competition are deferred to MVP-2.
- Arduino hardware is optional; the app can open and run without a connected board.
- Serial port access is handled in the Electron main process and exposed through preload APIs.
- Local session history is stored as JSON under Electron's user data directory.
- Windows test builds can be produced from Windows. macOS builds should be produced and tested on macOS.

## MVP-1 Verification Commands

```bash
npm run test:node
npm run lint
npm run build
```
