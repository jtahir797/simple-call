# 03 · Live captions

| Feature | Live call · captions | Status | Live |
|---|---|---|---|

## Purpose

The agents need the conversation as text without a bot joining the call and without sending audio to a server.

## Scope

- **In:** browser speech recognition in Chrome and Edge, on-device processing where supported, capture of the shared call audio (client) and the microphone (user), mic-only mode with manual speaker switch, typed lines.
- **Out:** audio recording, speaker diarisation of several client voices, non-English speech.

## Functional requirements

| ID | Requirement |
|---|---|
| FR-03.1 | Three caption sources: *Headphones* (call audio = client, mic = me), *Speakers* (call audio only), *Mic only* (user switches speaker with C and M). |
| FR-03.2 | Capture the client side from a shared tab or screen with audio (`getDisplayMedia`). |
| FR-03.3 | Use on-device speech when the browser supports it; offer to download the speech pack; show which engine is active. |
| FR-03.4 | *On-device only* setting refuses cloud speech. |
| FR-03.5 | Let the user type a line and mark it as client or self; *Ask* sends a typed client question straight to the answer chain. |
| FR-03.6 | Show interim text while the client is still speaking. |

## Business rules

- BR-03.1 Audio never leaves the laptop when on-device speech is active.
- BR-03.2 The on-device check runs only when the user asks, never on page load.
- BR-03.3 The UI reminds the user to tell the client an AI note-taker is in use.

## Acceptance criteria

- **AC-03.1** Given Chrome 139+ with the speech pack, when captions start, then the settings panel shows *Audio stays on this laptop*.
- **AC-03.2** Given *Headphones* mode and a shared Meet tab with audio, when the client speaks, then the line is labelled with the client's name.
- **AC-03.3** Given *On-device only* is ticked and the browser cannot do on-device speech, then captions do not start and the user is told to download the speech pack or allow cloud captions.

## Dependencies

Web Speech API (`SpeechRecognition.processLocally`, `available()`, `install()`), `hooks/useCopilot.ts`.
