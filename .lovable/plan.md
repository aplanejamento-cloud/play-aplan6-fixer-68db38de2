

## YouTube Video Fix: No External Links + Auto Pause on Scroll

### Problem
1. YouTube iframe embed allows clicking through to youtube.com
2. No auto-pause when scrolling out of viewport (only native `<video>` has this via `VideoPost`)
3. Multiple YouTube embeds can play simultaneously

### Plan

#### 1. Rewrite `YouTubeEmbed.tsx` — Use YouTube IFrame API with scroll-based pause

Replace the raw `<iframe>` with a controlled embed using the YouTube IFrame Player API:

- Load the YT IFrame API script once (global singleton)
- Create the player via `new YT.Player()` with `modestbranding: 1`, `rel: 0`, `disablekb: 0`
- **Block external links**: Use `origin` param + CSS `pointer-events: none` overlay on top of iframe, with a play/pause toggle button on click instead. This prevents any click from navigating to YouTube.
- **IntersectionObserver**: Pause when out of viewport (threshold 0.5), play when back in view — same pattern as `VideoPost.tsx`
- **Single active video**: When a video starts playing, dispatch a custom event `youtube-play` with the video ID; other instances listen and pause themselves

#### 2. Alternative simpler approach (recommended)

Keep the iframe but:
- Add `?modestbranding=1&rel=0&enablejsapi=1&origin=${window.location.origin}` params to block YouTube branding/links
- Wrap iframe in a container with a transparent overlay `div` that captures all clicks and toggles play/pause via `postMessage` to the iframe (YouTube IFrame API postMessage protocol)
- Use `IntersectionObserver` on the container to send pause/play `postMessage` commands
- Custom event bus for single-video-at-a-time

**Files to modify:**
- `src/components/feed/YouTubeEmbed.tsx` — full rewrite with overlay + postMessage + IntersectionObserver
- `src/components/feed/PostCard.tsx` — no changes needed (already renders `YouTubeEmbed`)

#### 3. Strip YouTube URLs from post text (already done)

Lines 220-221 in `PostCard.tsx` already replace YouTube links with `[link YouTube bloqueado]`. No change needed.

### Implementation Detail

```text
┌─────────────────────────────┐
│  Container (relative)       │
│  ┌───────────────────────┐  │
│  │  YouTube iframe        │  │
│  │  (pointer-events:none) │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Overlay (absolute)    │  │
│  │  onClick → postMessage │  │
│  │  play/pause toggle     │  │
│  └───────────────────────┘  │
│  IntersectionObserver       │
│  → pause when out of view   │
│  Custom event listener      │
│  → pause when other plays   │
└─────────────────────────────┘
```

**Key iframe params:** `?enablejsapi=1&modestbranding=1&rel=0&playsinline=1&origin=...`

**PostMessage commands:**
- Play: `iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*')`
- Pause: `iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*')`

This approach requires only modifying `YouTubeEmbed.tsx` — one file, ~80 lines.

