# ZoeyMind Desktop

## Release contract

The user operates releases by intent, not by GitHub mechanics.

### Ordinary development

- The user normally commits and pushes directly to `main`; business PRs are not required.
- Every push runs CI only.
- A normal push MUST NOT publish a GitHub Release, build public installers, or create a user-visible update.
- Do not ask the user to adopt Conventional Commit keywords. Use an appropriate commit message when committing on their behalf.

### Explicit release intent

Phrases such as `发布版本`, `发一个新版本`, `提交所有然后发 0.2`, or `把当前版本发出去` explicitly authorize an end-to-end release.

The agent MUST:

1. Review all current changes in this repository and run the commit checklist.
2. Finish required validation, commit all approved changes, and push `main`.
3. Treat the pushed `origin/main` HEAD as the release commit unless the user names another commit.
4. Normalize shorthand versions (`0.2` means `0.2.0`). If no version is given, choose the next sensible SemVer version from the changes and existing releases.
5. Trigger `.github/workflows/release.yml` with the normalized version and the chosen commit SHA. The workflow creates the tag and Draft Release, injects the version only into the Tauri build, builds all platforms, and publishes atomically.
6. Verify Windows x64, macOS ARM64, macOS Intel, Linux AppImage, Linux DEB, and `SHA256SUMS.txt` on the published GitHub Release.
7. If builds succeeded but checksum/upload/publication failed, use the workflow's artifact recovery input instead of rebuilding.
8. Report the published tag, URL, assets, and any signing or update-distribution limitations.

The agent MUST NOT ask the user to create tags, modify source-controlled version files, manually trigger Actions, or choose internal recovery inputs. Those are implementation details.

### Release lifecycle

- Source-controlled development versions remain `0.0.0`; release versions are workflow inputs injected at build time.
- A Draft GitHub Release should exist only while an explicitly requested release is being assembled or recovered.
- Normal release inputs are `version` and `release-ref`; the latter may name a stable commit, branch, or tag and defaults to `main`.
- `artifact-run-id` and `release-tag` are recovery-only inputs for reusing successful installers after a final-stage failure.
