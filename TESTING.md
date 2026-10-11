# Test record — Windows release 1.0.0

2026-10-11 · Windows 11 Pro 10.0.26200 x64 · Node.js 24.19.0 · Inno Setup 6.7.3.

## Automated checks

- `npm test`: **17 passed**, no Discord credentials needed. Covers parsing, permission checks, durable binding, owner isolation, upload limits, partial failure, rate limits, stale menus, concurrency, long results, locale keys/placeholders, per-interaction language and desktop startup failure/exit.
- `DSE.exe --self-test`: verifies language packs, offline help, runtime and executable paths. Result: PASS.
- `node windows/verify-package.mjs`: scans packaged files for local Token and binding identifiers, rejects private files and checks help images. Passed for build and installed application.
- `npm ci --omit=dev`: dependency audit reported zero known vulnerabilities at build time.

## Real desktop and installer checks

- Fresh config with blank Token displays startup failure and keeps installation buttons disabled.
- English, Traditional Chinese and Simplified Chinese switch in the native window. Saved language persists across restart.
- Open env configuration opens the built-in text editor; saving preserves the env template. Chinese editor font corrected after visual inspection.
- Existing local Token and target binding migrated to the user data directory; the desktop service connects to Discord using its bundled runtime.
- Help opens a local HTML page in the default browser. The desktop screenshot and labeled workflow illustration load correctly. A post-release visual review found that both original Discord crops included the server sidebar; they have been replaced by one generic illustration with no account or server information. Final published image files were visually reviewed; byte scanning alone cannot detect private information inside images.
- Stop service removes the bot process. Terminating the desktop also ends the child through stdin closure; no orphan service remains.
- `--background` hides the initial window; launching again opens the existing instance. One desktop process and one service process remain.
- Saving startup writes a quoted executable path plus `--background` under the current user's Windows Run key. No administrator privileges required.
- Installer completes with exit code 0. Uninstall removes the startup key, while SHA256 of `.env`, `.dse.json` and `settings.json` remains unchanged. Reinstall preserves the same files.

## Real Discord checks

- User installation and target-server bot installation completed; `/setup` binds the target.
- Earlier baseline: single static emoji plus a batch of one static and one animated reaction saved successfully.
- Installed desktop release: invoked Save Emoji on a message in a source server where the bot is not a member, selected an animated reaction and saved it to the target.
- Reply used English according to the Discord locale. API verification confirmed the new emoji's animated flag and that the bot belongs to the target server only.
- After command localization changed, Discord briefly returned “This command is outdated”. Reloading the client refreshed the command and the test passed.
- Replies remain ephemeral; no public test messages were sent.

## Not tested / limitations

- No physical Windows reboot or Windows 10 device test. Startup was verified by the persisted Windows entry and by launching background mode; Windows can independently disable startup apps.
- No code-signing certificate. Installer is unsigned.
- No simulated system-wide network outage, sleep/resume or long-duration soak test. Gateway readiness is checked every 5 seconds; login-stage failure requires manual restart after fixing configuration/network.
- No Linux build or deployment.
- Window size is small and uses WinForms rather than a bundled browser. A single observation after the live test showed approximately 90 MiB desktop working set + 70 MiB Node working set; this is not a benchmark or a guaranteed memory ceiling.
