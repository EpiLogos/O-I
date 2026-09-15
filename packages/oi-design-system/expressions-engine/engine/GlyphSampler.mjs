/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import * as THREE from "three";
import {
  CHAKRA_CYMATIC_PROFILES,
  renderChladniPlate,
  sampleVolumetric3DNodalPoints
} from "./cymatics.mjs";
import { sampleImageSource, sampleAlphaSource, SOURCE_WORK_MAX } from "./sourceSampling.mjs";
const FALLBACK_FONT_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
class GlyphSampler {
  canvas;
  ctx;
  /** Bounded scratch buffer for image source normalization. */
  workCanvas = document.createElement("canvas");
  targetCache = /* @__PURE__ */ new Map();
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1024;
    this.canvas.height = 1024;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Failed to create offscreen 2D canvas context for glyph rasterization");
    }
    this.ctx = context;
  }
  clearCache() {
    this.targetCache.clear();
  }
  /**
   * Renders a glyph or arbitrary string onto the offscreen canvas with automatic font-size scaling
   */
  rasterizeGlyph(glyphText, fontFamily = FALLBACK_FONT_STACK, fontWeight = 900) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const safeText = glyphText.trim() || "O";
    let targetFontSize = Math.floor(h * 0.52);
    ctx.font = `${fontWeight} ${targetFontSize}px ${fontFamily}`;
    const initialMeasure = ctx.measureText(safeText);
    const maxAllowableWidth = w * 0.88;
    if (initialMeasure.width > maxAllowableWidth) {
      const scale = maxAllowableWidth / initialMeasure.width;
      targetFontSize = Math.max(36, Math.floor(targetFontSize * scale));
    }
    ctx.font = `${fontWeight} ${targetFontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillText(safeText, cx, cy);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    let totalWeight = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          sumX += x * alpha;
          sumY += y * alpha;
          totalWeight += alpha;
        }
      }
    }
    if (totalWeight === 0) {
      minX = w * 0.3;
      maxX = w * 0.7;
      minY = h * 0.3;
      maxY = h * 0.7;
      sumX = cx;
      sumY = cy;
      totalWeight = 1;
    }
    const glyphCenter = new THREE.Vector2(
      sumX / totalWeight - cx,
      -(sumY / totalWeight - cy)
    );
    const subCenters = [];
    const chars = Array.from(safeText).filter((c) => c !== " ");
    if (chars.length > 1) {
      const spanWidth = Math.max(50, maxX - minX);
      const segmentWidth = spanWidth / chars.length;
      for (let i = 0; i < chars.length && i < 6; i++) {
        const segMinX = minX + i * segmentWidth;
        const segMaxX = segMinX + segmentWidth;
        let segSumX = 0;
        let segSumY = 0;
        let segWeight = 0;
        for (let y = minY; y <= maxY; y += 4) {
          for (let x = Math.floor(segMinX); x <= Math.floor(segMaxX); x += 4) {
            const idx = (y * w + x) * 4;
            const alpha = data[idx + 3];
            if (alpha > 20) {
              segSumX += x * alpha;
              segSumY += y * alpha;
              segWeight += alpha;
            }
          }
        }
        if (segWeight > 0) {
          subCenters.push(
            new THREE.Vector2(
              segSumX / segWeight - cx,
              -(segSumY / segWeight - cy)
            )
          );
        } else {
          const segCenterX = segMinX + segmentWidth * 0.5;
          subCenters.push(new THREE.Vector2(segCenterX - cx, glyphCenter.y));
        }
      }
    } else {
      subCenters.push(glyphCenter.clone());
    }
    return {
      imageData: imgData,
      bbox: { minX, maxX, minY, maxY },
      center: glyphCenter,
      subCenters
    };
  }
  /**
   * Generates target particle positions for a given glyph.
   * Supports both Stochastic Stipple (with perimeter falloff scatter) and Ordered Halftone Matrix.
   */
  generateTargetData(glyphText, particleCount, texWidth, texHeight, style = "stipple", fontFamily = FALLBACK_FONT_STACK, fontWeight = 900, worldScale = 0.85) {
    const cacheKey = `${glyphText}_${particleCount}_${texWidth}_${texHeight}_${style}_${fontFamily}_${fontWeight}_${worldScale}`;
    const cached = this.targetCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const { imageData, bbox, center, subCenters } = this.rasterizeGlyph(glyphText, fontFamily, fontWeight);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const pixels = imageData.data;
    const data = new Float32Array(texWidth * texHeight * 4);
    const strokeCandidates = [];
    const edgeCandidates = [];
    const pad = 40;
    const startX = Math.max(0, bbox.minX - pad);
    const endX = Math.min(w - 1, bbox.maxX + pad);
    const startY = Math.max(0, bbox.minY - pad);
    const endY = Math.min(h - 1, bbox.maxY + pad);
    const step = style === "halftone" ? 4 : 2;
    for (let y = startY; y <= endY; y += step) {
      for (let x = startX; x <= endX; x += step) {
        const idx = (y * w + x) * 4;
        const alpha = pixels[idx + 3] / 255;
        if (alpha > 0.02) {
          let edgeDist = 0;
          if (x > 2 && x < w - 2 && y > 2 && y < h - 2) {
            const aL = pixels[(y * w + (x - 2)) * 4 + 3];
            const aR = pixels[(y * w + (x + 2)) * 4 + 3];
            const aT = pixels[((y - 2) * w + x) * 4 + 3];
            const aB = pixels[((y + 2) * w + x) * 4 + 3];
            const grad = Math.abs(aR - aL) + Math.abs(aB - aT);
            edgeDist = grad / 510;
          }
          const cand = {
            x: (x - w / 2) * worldScale,
            y: -(y - h / 2) * worldScale,
            density: alpha
          };
          if (alpha > 0.65 && edgeDist < 0.25) {
            strokeCandidates.push(cand);
          } else {
            edgeCandidates.push(cand);
          }
        }
      }
    }
    const allCandidates = strokeCandidates.concat(edgeCandidates);
    const candidateCount = allCandidates.length;
    if (candidateCount === 0) {
      for (let i = 0; i < particleCount; i++) {
        const theta = i / particleCount * Math.PI * 2;
        const r = 180 + (Math.random() - 0.5) * 40;
        data[i * 4 + 0] = Math.cos(theta) * r;
        data[i * 4 + 1] = Math.sin(theta) * r;
        data[i * 4 + 2] = (Math.random() - 0.5) * 10;
        data[i * 4 + 3] = 0.8;
      }
      return { data, center, subCenters };
    }
    if (style === "halftone") {
      const gridPitch = 8.5;
      const gridCols = Math.ceil((bbox.maxX - bbox.minX + pad * 2) / gridPitch);
      const gridRows = Math.ceil((bbox.maxY - bbox.minY + pad * 2) / gridPitch);
      const gridNodes = [];
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const px = Math.floor(bbox.minX - pad + c * gridPitch);
          const py = Math.floor(bbox.minY - pad + r * gridPitch);
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = (py * w + px) * 4;
            const alpha = pixels[idx + 3] / 255;
            if (alpha > 0.05) {
              gridNodes.push({
                x: (px - w / 2) * worldScale,
                y: -(py - h / 2) * worldScale,
                density: alpha
              });
            }
          }
        }
      }
      const numGridNodes = Math.max(1, gridNodes.length);
      for (let i = 0; i < particleCount; i++) {
        const nodeIndex = i % numGridNodes;
        const node = gridNodes[nodeIndex];
        const microJitter = (Math.random() - 0.5) * 1.5;
        data[i * 4 + 0] = node.x + microJitter;
        data[i * 4 + 1] = node.y + microJitter;
        data[i * 4 + 2] = (Math.random() - 0.5) * 4;
        data[i * 4 + 3] = node.density;
      }
    } else {
      for (let i = 0; i < particleCount; i++) {
        const isCore = Math.random() < 0.72 && strokeCandidates.length > 0;
        const pool = isCore ? strokeCandidates : allCandidates;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const scatterRadius = isCore ? (Math.random() - 0.5) * 5 : (Math.random() - 0.5) * 22 * (1.05 - chosen.density);
        data[i * 4 + 0] = chosen.x + scatterRadius;
        data[i * 4 + 1] = chosen.y + scatterRadius;
        data[i * 4 + 2] = (Math.random() - 0.5) * 8;
        data[i * 4 + 3] = chosen.density;
      }
    }
    const result = { data, center, subCenters };
    this.targetCache.set(cacheKey, result);
    return result;
  }
  /**
   * Bakes target textures for glyph A and glyph B (for morphing)
   * Automatically recognizes any user-typed string, special characters, or word pairs
   */
  bakeTargets(glyphInput, particleCount, texWidth, texHeight, style, fontFamily = FALLBACK_FONT_STACK, fontWeight = 900) {
    let textA = "O";
    let textB = "I";
    if (Array.isArray(glyphInput)) {
      textA = glyphInput[0] || "O";
      textB = glyphInput[1] || textA;
    } else if (typeof glyphInput === "string") {
      const trimmed = glyphInput.trim();
      const splitTokens = trimmed.split(/[\s,⇄→/\-_|]+/).filter(Boolean);
      if (splitTokens.length >= 2) {
        textA = splitTokens[0];
        textB = splitTokens[1];
      } else if (splitTokens.length === 1) {
        const token = splitTokens[0];
        if (token.length >= 2 && Array.from(token).length === 2) {
          const chars = Array.from(token);
          textA = chars[0];
          textB = chars[1];
        } else {
          textA = token;
          textB = token;
        }
      }
    }
    const resA = this.generateTargetData(textA, particleCount, texWidth, texHeight, style, fontFamily, fontWeight);
    const resB = this.generateTargetData(textB, particleCount, texWidth, texHeight, style, fontFamily, fontWeight);
    const texA = new THREE.DataTexture(
      resA.data,
      texWidth,
      texHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;
    const texB = new THREE.DataTexture(
      resB.data,
      texWidth,
      texHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;
    const vortexCenter = new THREE.Vector2(
      (resA.center.x + resB.center.x) * 0.5,
      (resA.center.y + resB.center.y) * 0.5
    );
    const rawAttractors = [...resA.subCenters, ...resB.subCenters];
    const uniqueAttractors = [];
    for (const pt of rawAttractors) {
      const isDuplicate = uniqueAttractors.some((u) => u.distanceTo(pt) < 15);
      if (!isDuplicate) {
        uniqueAttractors.push(pt);
      }
    }
    if (uniqueAttractors.length < 2) {
      uniqueAttractors.push(new THREE.Vector2(-140, 0));
      uniqueAttractors.push(new THREE.Vector2(140, 0));
    }
    return {
      textureA: texA,
      textureB: texB,
      centerA: resA.center,
      centerB: resB.center,
      vortexCenter,
      attractorCenters: uniqueAttractors.slice(0, 6)
    };
  }
  /**
   * Vector-based drawing of sacred geometric yantras for the 7 primary chakras
   */
  /**
   * Helper to draw authentic pointed lotus petals for sacred yantras
   */
  drawLotusPetals(ctx, cx, cy, innerR, outerR, count, phase = 0) {
    const step = Math.PI * 2 / count;
    for (let i = 0; i < count; i++) {
      const midAngle = i * step + phase;
      const halfAngle = step * 0.48;
      const leftAngle = midAngle - halfAngle;
      const rightAngle = midAngle + halfAngle;
      const p1x = cx + Math.cos(leftAngle) * innerR;
      const p1y = cy + Math.sin(leftAngle) * innerR;
      const tipX = cx + Math.cos(midAngle) * outerR;
      const tipY = cy + Math.sin(midAngle) * outerR;
      const p2x = cx + Math.cos(rightAngle) * innerR;
      const p2y = cy + Math.sin(rightAngle) * innerR;
      const ctrlDist = innerR + (outerR - innerR) * 0.58;
      const c1x = cx + Math.cos(midAngle - halfAngle * 0.35) * ctrlDist;
      const c1y = cy + Math.sin(midAngle - halfAngle * 0.35) * ctrlDist;
      const c2x = cx + Math.cos(midAngle + halfAngle * 0.35) * ctrlDist;
      const c2y = cy + Math.sin(midAngle + halfAngle * 0.35) * ctrlDist;
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.quadraticCurveTo(c1x, c1y, tipX, tipY);
      ctx.quadraticCurveTo(c2x, c2y, p2x, p2y);
      ctx.stroke();
    }
  }
  /**
   * Vector-based drawing of sacred geometric yantras for the 7 primary chakras.
   * Pure sacred geometric mandala contours, sanctum rings, triangles, and bindus.
   */
  drawSacredYantra(ctx, chakraId, cx, cy, radius, isHarmonicB = false) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = Math.max(3.5, radius * 0.042);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const breath = isHarmonicB ? 1.08 : 1;
    const r = radius * breath;
    switch (chakraId) {
      case "muladhara": {
        const outerR = r * 0.95;
        const innerR = r * 0.68;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 4, -Math.PI / 2);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();
        const sqSize = innerR * 1.08;
        const halfSq = sqSize / 2;
        ctx.strokeRect(cx - halfSq, cy - halfSq, sqSize, sqSize);
        ctx.strokeRect(cx - halfSq * 0.82, cy - halfSq * 0.82, sqSize * 0.82, sqSize * 0.82);
        const triR = sqSize * 0.36;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "svadhisthana": {
        const outerR = r * 0.96;
        const innerR = r * 0.7;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 6, 0);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        const moonR = innerR * 0.62;
        ctx.beginPath();
        ctx.arc(cx, cy + moonR * 0.15, moonR, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.arc(cx, cy - moonR * 0.22, moonR * 0.85, 0.82 * Math.PI, 0.18 * Math.PI, true);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "manipura": {
        const outerR = r * 0.96;
        const innerR = r * 0.72;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 10, -Math.PI / 2);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        const triR = innerR * 0.76;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();
        const triInner = triR * 0.54;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triInner);
        ctx.lineTo(cx + triInner * 0.866, cy - triInner * 0.5);
        ctx.lineTo(cx - triInner * 0.866, cy - triInner * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.085, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "anahata": {
        const outerR = r * 0.98;
        const innerR = r * 0.74;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 12, 0);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.88, 0, Math.PI * 2);
        ctx.stroke();
        const starR = innerR * 0.75;
        ctx.beginPath();
        ctx.moveTo(cx, cy - starR);
        ctx.lineTo(cx + starR * 0.866, cy + starR * 0.5);
        ctx.lineTo(cx - starR * 0.866, cy + starR * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + starR);
        ctx.lineTo(cx + starR * 0.866, cy - starR * 0.5);
        ctx.lineTo(cx - starR * 0.866, cy - starR * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, starR * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "vishuddha": {
        const outerR = r * 0.98;
        const innerR = r * 0.75;
        this.drawLotusPetals(ctx, cx, cy, innerR, outerR, 16, 0);
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR * 0.86, 0, Math.PI * 2);
        ctx.stroke();
        const triR = innerR * 0.65;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, triR * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "ajna": {
        const wingR = r * 1.05;
        const centerR = r * 0.42;
        ctx.beginPath();
        ctx.moveTo(cx, cy - centerR);
        ctx.quadraticCurveTo(cx - wingR * 0.7, cy - centerR * 0.9, cx - wingR, cy);
        ctx.quadraticCurveTo(cx - wingR * 0.7, cy + centerR * 0.9, cx, cy + centerR);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - centerR * 0.6, cy);
        ctx.lineTo(cx - wingR * 0.85, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - centerR);
        ctx.quadraticCurveTo(cx + wingR * 0.7, cy - centerR * 0.9, cx + wingR, cy);
        ctx.quadraticCurveTo(cx + wingR * 0.7, cy + centerR * 0.9, cx, cy + centerR);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + centerR * 0.6, cy);
        ctx.lineTo(cx + wingR * 0.85, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
        ctx.stroke();
        const triR = centerR * 0.75;
        ctx.beginPath();
        ctx.moveTo(cx, cy + triR);
        ctx.lineTo(cx + triR * 0.866, cy - triR * 0.5);
        ctx.lineTo(cx - triR * 0.866, cy - triR * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "sahasrara":
      default: {
        const rOuter = r * 0.98;
        const rMid = r * 0.76;
        const rInner = r * 0.54;
        this.drawLotusPetals(ctx, cx, cy, rMid, rOuter, 24, 0);
        this.drawLotusPetals(ctx, cx, cy, rInner, rMid, 12, Math.PI / 12);
        ctx.beginPath();
        ctx.arc(cx, cy, rMid, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
        ctx.stroke();
        const spokeCount = 12;
        const spokeRot = isHarmonicB ? Math.PI / 12 : 0;
        for (let s = 0; s < spokeCount; s++) {
          const ang = s * Math.PI * 2 / spokeCount + spokeRot;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * (r * 0.14), cy + Math.sin(ang) * (r * 0.14));
          ctx.lineTo(cx + Math.cos(ang) * rInner, cy + Math.sin(ang) * rInner);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
  /**
   * Renders a specific node enforcing the sacred yantra geometric form
   */
  rasterizeSpatialNode(node, glyphType = "yantra", fontFamily = FALLBACK_FONT_STACK, fontWeight = 900, variant = "yantraA") {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    if (node.shape === "glyph") {
      const text = (node.glyphText || node.symbol || node.seedSyllable || "O").trim() || "O";
      let fontSize = Math.floor(h * 0.7);
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      const measured = ctx.measureText(text);
      const maxW = w * 0.9;
      if (measured.width > maxW) {
        fontSize = Math.max(24, Math.floor(fontSize * (maxW / measured.width)));
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, cx, cy);
    } else {
      this.drawSacredYantra(ctx, node.id, cx, cy, h * 0.38, variant === "yantraB");
    }
    const imgData = ctx.getImageData(0, 0, w, h);
    const pixels = imgData.data;
    const candidates = [];
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const idx = (y * w + x) * 4;
        const alpha = pixels[idx + 3] / 255;
        if (alpha > 0.05) {
          candidates.push({
            x: x - cx,
            y: -(y - cy),
            density: alpha
          });
        }
      }
    }
    if (candidates.length === 0) {
      for (let i = 0; i < 500; i++) {
        const ang = i / 500 * Math.PI * 2;
        const rad = 100 + (Math.random() - 0.5) * 20;
        candidates.push({
          x: Math.cos(ang) * rad,
          y: Math.sin(ang) * rad,
          density: 0.8
        });
      }
    }
    return { candidates };
  }
  /**
   * Generates candidate coordinates according to exact Chladni / cymatic harmonic wave equations
   */
  sampleCymaticNode(node, plateGeometry = "square", dimension = "2D", coherence = 1, chaos = 0, frequencyOverride) {
    const freq = frequencyOverride ?? node.frequencyHz ?? 396;
    const profile = CHAKRA_CYMATIC_PROFILES.find(
      (p) => p.chakraId === node.id || p.frequencyHz === freq
    ) || CHAKRA_CYMATIC_PROFILES[0];
    if (dimension === "3D" || plateGeometry === "volumetric3D") {
      const pts = sampleVolumetric3DNodalPoints(
        12e3,
        profile.volumetricL,
        profile.volumetricM,
        profile.volumetricN,
        coherence,
        chaos,
        280
      );
      return { candidates: pts, is3D: true };
    }
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    renderChladniPlate(
      ctx,
      w,
      h,
      plateGeometry,
      profile.squareM,
      profile.squareN,
      profile.squareA,
      profile.squareB,
      coherence,
      chaos
    );
    const imgData = ctx.getImageData(0, 0, w, h);
    const pixels = imgData.data;
    const candidates = [];
    const cx = w / 2;
    const cy = h / 2;
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const idx = (y * w + x) * 4;
        const alpha = pixels[idx + 3] / 255;
        if (alpha > 0.05) {
          candidates.push({
            x: x - cx,
            y: -(y - cy),
            z: 0,
            density: alpha
          });
        }
      }
    }
    if (candidates.length === 0) {
      for (let i = 0; i < 500; i++) {
        const ang = i / 500 * Math.PI * 2;
        candidates.push({
          x: Math.cos(ang) * 120,
          y: Math.sin(ang) * 120,
          z: 0,
          density: 0.8
        });
      }
    }
    return { candidates, is3D: false };
  }
  /**
   * Bakes target textures for sequential Kundalini spatial morphing (Node A in space -> Node B in space)
   */
  bakeChakraSequentialTargets(nodeA, nodeB, particleCount, texWidth, texHeight, style = "stipple", glyphType = "yantra", fontFamily = FALLBACK_FONT_STACK, fontWeight = 900, plane = "horizontal", geometryMode = "yantra", cymatics) {
    const isCymatics = geometryMode === "cymatics";
    const nodeIsCymatic = (n) => n.shape === "cymatic" || isCymatics && n.shape !== "glyph" && n.shape !== "yantra";
    const resA = nodeIsCymatic(nodeA) ? this.sampleCymaticNode(nodeA, cymatics?.plateGeometry, cymatics?.dimension, 1, 0) : { ...this.rasterizeSpatialNode(nodeA, glyphType, fontFamily, fontWeight, "yantraA"), is3D: false };
    const resB = nodeIsCymatic(nodeB) ? this.sampleCymaticNode(nodeB, cymatics?.plateGeometry, cymatics?.dimension, 1, 0) : { ...this.rasterizeSpatialNode(nodeB, glyphType, fontFamily, fontWeight, "yantraA"), is3D: false };
    const dataA = new Float32Array(texWidth * texHeight * 4);
    const dataB = new Float32Array(texWidth * texHeight * 4);
    const countA = resA.candidates.length;
    const countB = resB.candidates.length;
    const scaleA = nodeA.scale ?? 0.2;
    const scaleB = nodeB.scale ?? 0.2;
    for (let i = 0; i < particleCount; i++) {
      const pA = resA.candidates[i % countA];
      const pB = resB.candidates[i % countB];
      if (resA.is3D || cymatics?.dimension === "3D") {
        const jAx = (Math.random() - 0.5) * 2;
        const jAy = (Math.random() - 0.5) * 2;
        const jAz = (Math.random() - 0.5) * 2;
        dataA[i * 4 + 0] = pA.x * scaleA + nodeA.x + jAx;
        dataA[i * 4 + 1] = pA.y * scaleA - nodeA.y + jAy;
        dataA[i * 4 + 2] = (pA.z ?? 0) * scaleA + jAz;
        dataA[i * 4 + 3] = pA.density;
        const jBx = (Math.random() - 0.5) * 2;
        const jBy = (Math.random() - 0.5) * 2;
        const jBz = (Math.random() - 0.5) * 2;
        dataB[i * 4 + 0] = pB.x * scaleB + nodeB.x + jBx;
        dataB[i * 4 + 1] = pB.y * scaleB - nodeB.y + jBy;
        dataB[i * 4 + 2] = (pB.z ?? 0) * scaleB + jBz;
        dataB[i * 4 + 3] = pB.density;
      } else if (plane === "horizontal") {
        const jAx = (Math.random() - 0.5) * 2;
        const jAz = (Math.random() - 0.5) * 2;
        dataA[i * 4 + 0] = pA.x * scaleA + nodeA.x + jAx;
        dataA[i * 4 + 1] = -nodeA.y;
        dataA[i * 4 + 2] = pA.y * scaleA + jAz;
        dataA[i * 4 + 3] = pA.density;
        const jBx = (Math.random() - 0.5) * 2;
        const jBz = (Math.random() - 0.5) * 2;
        dataB[i * 4 + 0] = pB.x * scaleB + nodeB.x + jBx;
        dataB[i * 4 + 1] = -nodeB.y;
        dataB[i * 4 + 2] = pB.y * scaleB + jBz;
        dataB[i * 4 + 3] = pB.density;
      } else {
        const jitterAx = (Math.random() - 0.5) * 3;
        const jitterAy = (Math.random() - 0.5) * 3;
        dataA[i * 4 + 0] = pA.x * scaleA + nodeA.x + jitterAx;
        dataA[i * 4 + 1] = pA.y * scaleA - nodeA.y + jitterAy;
        dataA[i * 4 + 2] = (Math.random() - 0.5) * 8;
        dataA[i * 4 + 3] = pA.density;
        const jitterBx = (Math.random() - 0.5) * 3;
        const jitterBy = (Math.random() - 0.5) * 3;
        dataB[i * 4 + 0] = pB.x * scaleB + nodeB.x + jitterBx;
        dataB[i * 4 + 1] = pB.y * scaleB - nodeB.y + jitterBy;
        dataB[i * 4 + 2] = (Math.random() - 0.5) * 8;
        dataB[i * 4 + 3] = pB.density;
      }
    }
    const texA = new THREE.DataTexture(dataA, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;
    const texB = new THREE.DataTexture(dataB, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;
    const vortexCenter = new THREE.Vector2(
      (nodeA.x + nodeB.x) * 0.5,
      (-nodeA.y - nodeB.y) * 0.5
    );
    const attractorCenters = [
      new THREE.Vector2(nodeA.x, -nodeA.y),
      new THREE.Vector2(nodeB.x, -nodeB.y)
    ];
    return {
      textureA: texA,
      textureB: texB,
      centerA: new THREE.Vector2(nodeA.x, -nodeA.y),
      centerB: new THREE.Vector2(nodeB.x, -nodeB.y),
      vortexCenter,
      attractorCenters
    };
  }
  /**
   * Bakes target textures for simultaneous Chakra Subtle Body constellation.
   * Particles are partitioned across all active spatial nodes.
   * Target A = Seed syllable representation; Target B = Sacred Yantra representation.
   */
  bakeChakraSimultaneousTargets(nodes, particleCount, texWidth, texHeight, style = "stipple", glyphType = "both", fontFamily = FALLBACK_FONT_STACK, fontWeight = 900, plane = "horizontal", geometryMode = "yantra", cymatics) {
    const isCymatics = geometryMode === "cymatics";
    const activeNodes = nodes.filter((n) => n.active);
    const validNodes = activeNodes.length > 0 ? activeNodes : nodes;
    const K = validNodes.length;
    const dataA = new Float32Array(texWidth * texHeight * 4);
    const dataB = new Float32Array(texWidth * texHeight * 4);
    const particlesPerNode = Math.floor(particleCount / K);
    const attractorCenters = [];
    let sumX = 0;
    let sumY = 0;
    for (let k = 0; k < K; k++) {
      const node = validNodes[k];
      attractorCenters.push(new THREE.Vector2(node.x, -node.y));
      sumX += node.x;
      sumY += -node.y;
      const nodeCym = node.shape === "cymatic" || isCymatics && node.shape !== "glyph" && node.shape !== "yantra";
      const resA = nodeCym ? this.sampleCymaticNode(node, cymatics?.plateGeometry, cymatics?.dimension, 1, 0) : { ...this.rasterizeSpatialNode(node, glyphType, fontFamily, fontWeight, "yantraA"), is3D: false };
      const resB = nodeCym ? this.sampleCymaticNode(node, cymatics?.plateGeometry, cymatics?.dimension, 0.95, 0.1) : { ...this.rasterizeSpatialNode(node, glyphType, fontFamily, fontWeight, "yantraB"), is3D: false };
      const startIndex = k * particlesPerNode;
      const endIndex = k === K - 1 ? particleCount : (k + 1) * particlesPerNode;
      const countA = resA.candidates.length;
      const countB = resB.candidates.length;
      const nodeScale = node.scale ?? 0.2;
      for (let i = startIndex; i < endIndex; i++) {
        const localIdx = i - startIndex;
        const pA = resA.candidates[localIdx % countA];
        const pB = resB.candidates[localIdx % countB];
        if (resA.is3D || cymatics?.dimension === "3D") {
          const jAx = (Math.random() - 0.5) * 2;
          const jAy = (Math.random() - 0.5) * 2;
          const jAz = (Math.random() - 0.5) * 2;
          dataA[i * 4 + 0] = pA.x * nodeScale + node.x + jAx;
          dataA[i * 4 + 1] = pA.y * nodeScale - node.y + jAy;
          dataA[i * 4 + 2] = (pA.z ?? 0) * nodeScale + jAz;
          dataA[i * 4 + 3] = pA.density;
          const jBx = (Math.random() - 0.5) * 2;
          const jBy = (Math.random() - 0.5) * 2;
          const jBz = (Math.random() - 0.5) * 2;
          dataB[i * 4 + 0] = pB.x * nodeScale + node.x + jBx;
          dataB[i * 4 + 1] = pB.y * nodeScale - node.y + jBy;
          dataB[i * 4 + 2] = (pB.z ?? 0) * nodeScale + jBz;
          dataB[i * 4 + 3] = pB.density;
        } else if (plane === "horizontal") {
          const jAx = (Math.random() - 0.5) * 2;
          const jAz = (Math.random() - 0.5) * 2;
          dataA[i * 4 + 0] = pA.x * nodeScale + node.x + jAx;
          dataA[i * 4 + 1] = -node.y;
          dataA[i * 4 + 2] = pA.y * nodeScale + jAz;
          dataA[i * 4 + 3] = pA.density;
          const jBx = (Math.random() - 0.5) * 2;
          const jBz = (Math.random() - 0.5) * 2;
          dataB[i * 4 + 0] = pB.x * nodeScale + node.x + jBx;
          dataB[i * 4 + 1] = -node.y;
          dataB[i * 4 + 2] = pB.y * nodeScale + jBz;
          dataB[i * 4 + 3] = pB.density;
        } else {
          const jAx = (Math.random() - 0.5) * 3;
          const jAy = (Math.random() - 0.5) * 3;
          dataA[i * 4 + 0] = pA.x * nodeScale + node.x + jAx;
          dataA[i * 4 + 1] = pA.y * nodeScale - node.y + jAy;
          dataA[i * 4 + 2] = (Math.random() - 0.5) * 8;
          dataA[i * 4 + 3] = pA.density;
          const jBx = (Math.random() - 0.5) * 3;
          const jBy = (Math.random() - 0.5) * 3;
          dataB[i * 4 + 0] = pB.x * nodeScale + node.x + jBx;
          dataB[i * 4 + 1] = pB.y * nodeScale - node.y + jBy;
          dataB[i * 4 + 2] = (Math.random() - 0.5) * 8;
          dataB[i * 4 + 3] = pB.density;
        }
      }
    }
    const texA = new THREE.DataTexture(dataA, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;
    const texB = new THREE.DataTexture(dataB, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;
    const vortexCenter = new THREE.Vector2(sumX / K, sumY / K);
    return {
      textureA: texA,
      textureB: texB,
      centerA: vortexCenter.clone(),
      centerB: vortexCenter.clone(),
      vortexCenter,
      attractorCenters: attractorCenters.slice(0, 10)
    };
  }
  /**
   * Samples pixel density from a custom user image through the shared
   * normalization law (background estimate, polarity, crop, mode shaping).
   */
  rasterizeCustomImage(img, options = {}) {
    const { px, w, h } = this.drawToWorkBuffer(img);
    const sampled = sampleImageSource(px, w, h, options);
    return { candidates: sampled.candidates, center: new THREE.Vector2(0, 0), analysis: sampled.analysis };
  }
  /** Bounded working copy: sampling never touches raw source resolution. */
  drawToWorkBuffer(img) {
    const naturalW = img.naturalWidth || img.width || img.width || SOURCE_WORK_MAX;
    const naturalH = img.naturalHeight || img.height || img.height || SOURCE_WORK_MAX;
    const fit = Math.min(1, SOURCE_WORK_MAX / Math.max(naturalW, naturalH));
    const w = Math.max(2, Math.round(naturalW * fit));
    const h = Math.max(2, Math.round(naturalH * fit));
    const work = this.workCanvas.getContext("2d", { willReadFrequently: true });
    if (!work) throw new Error("Failed to create offscreen 2D canvas context for source sampling");
    if (this.workCanvas.width !== w || this.workCanvas.height !== h) {
      this.workCanvas.width = w;
      this.workCanvas.height = h;
    }
    work.clearRect(0, 0, w, h);
    if (img instanceof ImageData) {
      work.putImageData(img, 0, 0);
      const drawn2 = work.getImageData(0, 0, w, h);
      return { px: drawn2.data, w, h };
    }
    work.drawImage(img, 0, 0, w, h);
    const drawn = work.getImageData(0, 0, w, h);
    return { px: drawn.data, w, h };
  }
  /**
   * Samples pixel density from multi-line ASCII art text through the same
   * normalization law as images (crop, stage units, density = alpha).
   */
  rasterizeAscii(asciiText, options = {}) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const rawLines = asciiText.split("\n");
    const lines = rawLines.length > 0 ? rawLines : ["[EMPTY ASCII]"];
    const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
    const numLines = lines.length;
    const computedSize = Math.floor(Math.min(w * 0.82 / (maxLineLen * 0.6), h * 0.82 / Math.max(1, numLines * 1.15)));
    const fontSize = options.fontSize || Math.max(12, Math.min(72, computedSize));
    ctx.font = `bold ${fontSize}px ${options.fontFamily || '"Fira Code", "Courier New", Courier, monospace'}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const lineHeight = fontSize * 1.15;
    const charWidth = fontSize * 0.6;
    const totalW = maxLineLen * charWidth;
    const totalH = numLines * lineHeight;
    const startX = (w - totalW) / 2;
    const startY = (h - totalH) / 2 + lineHeight / 2;
    for (let r = 0; r < lines.length; r++) {
      ctx.fillText(lines[r], startX, startY + r * lineHeight);
    }
    const imgData = ctx.getImageData(0, 0, w, h);
    const sampled = sampleAlphaSource(imgData.data, w, h, {
      invert: options.invert,
      cell: { w: charWidth, h: lineHeight }
    });
    return { candidates: sampled.candidates, center: new THREE.Vector2(0, 0), analysis: sampled.analysis };
  }
  /**
   * Bakes target textures from arbitrary candidate points
   */
  bakeCandidatePoolToTargets(candidatesA, candidatesB, particleCount, texWidth, texHeight, style = "stipple") {
    const dataA = new Float32Array(texWidth * texHeight * 4);
    const dataB = new Float32Array(texWidth * texHeight * 4);
    const countA = candidatesA.length;
    const countB = candidatesB.length;
    for (let i = 0; i < particleCount; i++) {
      const pA = candidatesA[i % countA];
      const pB = candidatesB[i % countB];
      const jAx = style === "halftone" ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5;
      const jAy = style === "halftone" ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5;
      dataA[i * 4 + 0] = pA.x + jAx;
      dataA[i * 4 + 1] = pA.y + jAy;
      dataA[i * 4 + 2] = (pA.z ?? 0) + (Math.random() - 0.5) * 4;
      dataA[i * 4 + 3] = pA.density;
      const jBx = style === "halftone" ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5;
      const jBy = style === "halftone" ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 5;
      dataB[i * 4 + 0] = pB.x + jBx;
      dataB[i * 4 + 1] = pB.y + jBy;
      dataB[i * 4 + 2] = (pB.z ?? 0) + (Math.random() - 0.5) * 4;
      dataB[i * 4 + 3] = pB.density;
    }
    const texA = new THREE.DataTexture(dataA, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texA.needsUpdate = true;
    texA.minFilter = THREE.NearestFilter;
    texA.magFilter = THREE.NearestFilter;
    const texB = new THREE.DataTexture(dataB, texWidth, texHeight, THREE.RGBAFormat, THREE.FloatType);
    texB.needsUpdate = true;
    texB.minFilter = THREE.NearestFilter;
    texB.magFilter = THREE.NearestFilter;
    const zero = new THREE.Vector2(0, 0);
    return {
      textureA: texA,
      textureB: texB,
      centerA: zero.clone(),
      centerB: zero.clone(),
      vortexCenter: zero.clone(),
      attractorCenters: [zero.clone()]
    };
  }
  destroy() {
    this.targetCache.clear();
    this.canvas.width = 1;
    this.canvas.height = 1;
  }
}
export {
  FALLBACK_FONT_STACK,
  GlyphSampler
};
