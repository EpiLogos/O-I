# Original point-cloud delivery assets

The 2026-09-12 UI handoff referred to these assets, but none was present in
`site/redesign-v2` at `debf59dee7c99aa14239a6622b3d42c87887c349`. The directory
was entirely excluded by the root `.gitignore`; its branch history contains
no media commits. They cannot be recovered from that checkout.

The UI refinement retains the original filenames and does not substitute
stock media, generated imitations, the Expressions application, or test
fixtures. The narrow ignore exceptions now allow the seven delivery assets:

- `oi-pointcloud-a.mp4`, `oi-pointcloud-b.mp4`, `oi-pointcloud-c.mp4`, `oi-pointcloud-d.mp4`
- `oi-pointcloud-poster-1.jpg`, `oi-pointcloud-poster-2.jpg`, `oi-pointcloud-poster-3.jpg`

## Complete the original local handoff

From the checkout that actually contains the accepted media, first reconcile
any uncommitted work and fast-forward `site/redesign-v2`. Then stage only the
seven named originals, commit, and push that branch. Raw source materials
remain ignored. Do not replace missing originals with approximations.

```sh
git add site/public/media/motion/oi-pointcloud-[a-d].mp4 \
        site/public/media/motion/oi-pointcloud-poster-[1-3].jpg
git commit -m "site: deliver the accepted point-cloud videos and posters"
git push origin site/redesign-v2
```

The browser acceptance suite records missing assets as an explicit failed
media-delivery contract. Layout, text preservation, route and interaction
cases still run and are reported separately; they do not confer media or
visual acceptance. Once originals land, the same suite validates image
loading and the autoplay-refusal poster path, and records asset SHA-256s.
Inspect the actual hero and bands at desktop, phone and landscape ratios
before accepting cloud framing, feathering or contrast.
