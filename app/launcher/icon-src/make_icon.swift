// Generates the Job Tracker app icon as a 1024x1024 PNG using Core Graphics.
// Headless — no GUI session required. Run with: swift make_icon.swift <output.png>
// Design: rounded square in the app's brand purple (#4f46e5, matches the sidebar
// "JT" mark and --accent in styles.css) with a simple white briefcase glyph,
// echoing the 💼 used for "Jobs" in the app's own nav.
//
// This is SOURCE only — the built .icns/.ico are committed directly (in
// "app/launcher/JobTracker.icns" and "app/launcher/windows/") rather than
// regenerated on every install. To change the icon design, edit this file
// and rebuild with (all commands run from launcher/icon-src/, macOS only):
//
//   swift make_icon.swift icon-1024.png
//
//   # macOS .icns:
//   mkdir JobTracker.iconset
//   for s in 16 32 128 256 512; do
//     sips -z $s $s icon-1024.png --out JobTracker.iconset/icon_${s}x${s}.png
//     d=$((s*2)); sips -z $d $d icon-1024.png --out JobTracker.iconset/icon_${s}x${s}@2x.png
//   done
//   iconutil -c icns JobTracker.iconset -o JobTracker.icns
//   cp JobTracker.icns ../JobTracker.icns   # then: bash ../mac/build-app.sh
//
//   # Windows .ico (multi-res, PNG-embedded — see git history for the exact
//   # one-off Python packer used, or use any standard ICO tool):
//   for s in 16 32 48 256; do sips -z $s $s icon-1024.png --out ico-$s.png; done
//   # then pack ico-16/32/48/256.png into launcher/windows/JobTracker.ico

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024.0
let outPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(
    data: nil, width: Int(size), height: Int(size),
    bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("could not create context") }

// Transparent canvas, macOS composites the rounded-square mask itself for .icns,
// but we still draw our own rounded rect so the PNG looks right everywhere else.
ctx.clear(CGRect(x: 0, y: 0, width: size, height: size))

// Background: rounded square in brand purple (#4f46e5).
let bgInset = size * 0.04
let bgRect = CGRect(x: bgInset, y: bgInset, width: size - bgInset * 2, height: size - bgInset * 2)
let bgRadius = bgRect.width * 0.225 // roughly matches macOS's squircle-ish icon convention
let bgPath = CGPath(roundedRect: bgRect, cornerWidth: bgRadius, cornerHeight: bgRadius, transform: nil)
ctx.setFillColor(red: Double(0x4f) / 255, green: Double(0x46) / 255, blue: Double(0xe5) / 255, alpha: 1)
ctx.addPath(bgPath)
ctx.fillPath()

// Subtle top-to-bottom highlight for a touch of depth (kept minimal).
ctx.saveGState()
ctx.addPath(bgPath)
ctx.clip()
let gradColors = [
    CGColor(red: 1, green: 1, blue: 1, alpha: 0.10),
    CGColor(red: 1, green: 1, blue: 1, alpha: 0.0),
] as CFArray
if let grad = CGGradient(colorsSpace: colorSpace, colors: gradColors, locations: [0, 0.6]) {
    ctx.drawLinearGradient(grad, start: CGPoint(x: size / 2, y: size), end: CGPoint(x: size / 2, y: size * 0.4), options: [])
}
ctx.restoreGState()

// Foreground: a simple white briefcase glyph, centered.
func roundedRectPath(_ rect: CGRect, radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
ctx.setFillColor(white)

// Briefcase body.
let bodyW = size * 0.46
let bodyH = size * 0.32
let bodyX = (size - bodyW) / 2
let bodyY = size * 0.34
let bodyRect = CGRect(x: bodyX, y: bodyY, width: bodyW, height: bodyH)
ctx.addPath(roundedRectPath(bodyRect, radius: size * 0.035))
ctx.fillPath()

// Handle (drawn as a stroked rounded rect arc sitting above the body).
let handleW = size * 0.18
let handleH = size * 0.11
let handleX = (size - handleW) / 2
let handleY = bodyY + bodyH - size * 0.02
let handleRect = CGRect(x: handleX, y: handleY, width: handleW, height: handleH)
ctx.setStrokeColor(white)
ctx.setLineWidth(size * 0.045)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.addPath(roundedRectPath(handleRect, radius: size * 0.05))
ctx.strokePath()

// Clasp: a thin brand-purple slit through the middle of the body, like a real
// briefcase's horizontal seam — cut out of the white body using blend mode.
let claspRect = CGRect(x: bodyX + size * 0.02, y: bodyY + bodyH * 0.46, width: bodyW - size * 0.04, height: size * 0.02)
ctx.setBlendMode(.clear)
ctx.fill(claspRect)
ctx.setBlendMode(.normal)

guard let image = ctx.makeImage() else { fatalError("could not render image") }

let url = URL(fileURLWithPath: outPath)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fatalError("could not create image destination")
}
CGImageDestinationAddImage(dest, image, nil)
if !CGImageDestinationFinalize(dest) {
    fatalError("could not write PNG")
}
print("wrote \(outPath)")
