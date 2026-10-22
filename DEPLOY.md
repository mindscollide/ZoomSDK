# Zoom iframe app: build & deploy

This app is embedded by Diskus in an `<iframe>`. Each environment serves it from the **root** of its `:9414` site. The build loads `/static/...` and the SDK loads `/lib/<sdk version>/...` from the site root, so it does **not** work from a sub-folder such as `/zoom/`.

## SDK version

`@zoom/videosdk` is pinned to **2.5.0** (same as the working portal deployment). Do not deploy a build made with an older SDK: 2.1.0 draws video with a WebGL canvas that fails in Safari (black screen, `active-media-failed`). Quick check of a deployed server: `https://<host>:9414/lib/2.5.0/js_media.min.js` must be **1,682,333 bytes** and `tp.min.js` **418,618 bytes**. 845,680 / 47,769 means the old 2.1.0 media files. (Builds before the versioned folder served these directly under `/lib/`.)

Video is rendered with `attachVideo` into `<video-player>` elements (`src/feature/video/video-single.tsx`). SDK 2.5 rejects the old canvas `renderVideo` with errorCode 6112, which shows a black screen even though the camera is on. Verified working on UAT (Safari) on 2026-09-29. Received screen shares (including presenter view) are rendered the same way with `attachShareView` (`hooks/useShare.ts`, `components/share-view.tsx`); the old canvas `startShareView` showed nothing to Mac viewers. Built for UAT 2026-10-01, not yet verified.

## Browser caching

The SDK media files have fixed names (`js_media.min.js`, `*.wasm`, …) and IIS sends no `Cache-Control` header, so browsers cache them. Served from a fixed `/lib/` path, a browser that cached an older SDK's files kept using them after an upgrade, mixed them with the new SDK code, and the join hung on the loader until the cache was cleared.

The build therefore puts them in `lib/<sdk version>/` (`scripts/zoom-sdk-lib.js`; `sync:lib` and `config-overrides.js` copy them there, and `App.tsx` loads from the same path through `REACT_APP_ZOOM_SDK_VERSION`). Each SDK upgrade gets new URLs, and the files still cache between upgrades. The app's own JS in `static/` is content-hashed. Diskus adds a unique `_v=` param to the iframe URL so `index.html` itself is never served from cache.

If the SDK still fails to load or join, the app shows "Video could not start" with a Retry button (after at most 90 s for loading, 60 s for joining) instead of an endless loader.

## Environments

| Env | Diskus app (parent origin) | Zoom app URL (deploy target) | JWT endpoint | Build command | Output folder |
|---|---|---|---|---|---|
| UAT | `https://secure.letsdiskus.com` | `https://secure.letsdiskus.com:9414/index.html` | `https://secure.letsdiskus.com:9414/api/Video/GenerateVideoSdkJwt` | `npm run build:uat` | `build-uat/` |
| Production | `https://secure.diskusboard.com` | `https://secure.diskusboard.com:9414/index.html` | `https://secure.diskusboard.com:9414/api/Video/GenerateVideoSdkJwt` | `npm run build:production` | `build-production/` |
| Staging | `https://portal.letsdiskus.com` | `https://portal.letsdiskus.com:9414/index.html` | `https://portal.letsdiskus.com:9414/api/Video/GenerateVideoSdkJwt` | `npm run build` (generic) | `build/` |

The per-environment scripts set:
- `REACT_APP_PARENT_ORIGINS`: the only Diskus origin allowed to send commands to the iframe (mic, camera, share, leave, recording).
- `REACT_APP_AUTH_ENDPOINT`: the Video SDK JWT endpoint.
- `REACT_APP_HIDE_SDK_FOOTER=true`: hides the Zoom control footer, since Diskus provides the call controls. The footer stays mounted (only hidden with CSS) because it also handles Diskus's mic/camera/share/leave messages. Local dev and the generic `npm run build` still show it.

`npm run build` (generic) uses `.env.production`, which allows all Diskus origins and derives the JWT endpoint from the page's own origin, so that one build works on any environment.

## Deploy steps (per environment)

1. `npm install` (first time, or after dependency changes)
2. `npm run build:uat` or `npm run build:production`
3. On the server, **back up** the current `:9414` site root.
4. Replace the site-root contents with the output folder's contents: `index.html`, `static/`, `lib/`, and the other files in it. Old SDK files left directly under `lib/` (from before the versioned folder) are no longer used and can be deleted.
5. Check the org settings `Zoom_Video_Server_Base_URL_Caller` / `_Participant` point to `https://<host>:9414/index.html`, not a `/zoom/...` path.
6. Hard-refresh the browser (or clear the cache) and verify:
   - `https://<host>:9414/index.html` loads a `main.<hash>.js` newer than the previous deploy.
   - In a call: camera and mic work (including Safari), and Diskus mic/camera/leave buttons control the call.
   - In the iframe's Network tab, `GenerateVideoSdkJwt` goes to the endpoint in the table above and returns `responseCode: 200`.

## Changing an origin or endpoint

Values are baked in at build time. Edit the script in `package.json` (or `.env.*`) and rebuild.
