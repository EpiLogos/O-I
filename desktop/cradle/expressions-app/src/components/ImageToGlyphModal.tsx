/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  X,
  Sliders,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { CustomImageConfig } from '../engine/types';

export interface ImageToGlyphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBakeImage: (
    image: HTMLImageElement | HTMLCanvasElement,
    config: CustomImageConfig
  ) => void;
  isLight: boolean;
}

export const ImageToGlyphModal: React.FC<ImageToGlyphModalProps> = ({
  isOpen,
  onClose,
  onBakeImage,
  isLight,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<'luminance' | 'edgeSobel' | 'silhouette'>('edgeSobel');
  const [threshold, setThreshold] = useState<number>(0.35);
  const [invert, setInvert] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(0.85);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pointCountEst, setPointCountEst] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Load a default sample glyph image if none provided yet
  useEffect(() => {
    if (!imageSrc && isOpen) {
      // Create a default geometric sacred geometry icon on an offscreen canvas
      const cvs = document.createElement('canvas');
      cvs.width = 300;
      cvs.height = 300;
      const ctx = cvs.getContext('2d')!;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 300, 300);

      // Draw intricate concentric circles and polygon
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(150, 150, 100, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const x = 150 + Math.cos(ang) * 50;
        const y = 150 + Math.sin(ang) * 50;
        ctx.beginPath();
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(150, 150, 30, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      const dataUrl = cvs.toDataURL();
      setImageSrc(dataUrl);

      const img = new Image();
      img.onload = () => {
        loadedImageRef.current = img;
        updatePreview();
      };
      img.src = dataUrl;
    }
  }, [isOpen, imageSrc]);

  // Handle user image file drop / selection
  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageSrc(result);
      const img = new Image();
      img.onload = () => {
        loadedImageRef.current = img;
        updatePreview();
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Live preview rasterizer
  const updatePreview = useCallback(() => {
    const img = loadedImageRef.current;
    const canvas = previewCanvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 240;
    const h = 240;
    canvas.width = w;
    canvas.height = h;

    // Draw offscreen scaled image
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d')!;
    offCtx.fillStyle = '#000000';
    offCtx.fillRect(0, 0, w, h);

    const aspect = img.width / img.height;
    let dw = w * scale;
    let dh = h * scale;
    if (aspect > 1) {
      dh = dw / aspect;
    } else {
      dw = dh * aspect;
    }
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    offCtx.drawImage(img, dx, dy, dw, dh);

    const imgData = offCtx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Process preview pixels according to algorithm
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#00f0ff';

    let count = 0;
    const step = 2;

    if (mode === 'edgeSobel') {
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
      }
      for (let y = 1; y < h - 1; y += step) {
        for (let x = 1; x < w - 1; x += step) {
          const idx = y * w + x;
          const gx =
            -lum[idx - w - 1] + lum[idx - w + 1] -
            2 * lum[idx - 1] + 2 * lum[idx + 1] -
            lum[idx + w - 1] + lum[idx + w + 1];
          const gy =
            -lum[idx - w - 1] - 2 * lum[idx - w] - lum[idx - w + 1] +
            lum[idx + w - 1] + 2 * lum[idx + w] + lum[idx + w + 1];
          let mag = Math.sqrt(gx * gx + gy * gy);
          if (invert) mag = 1.0 - mag;
          if (mag >= threshold) {
            ctx.fillRect(x, y, 1.5, 1.5);
            count++;
          }
        }
      }
    } else {
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const idx = (y * w + x) * 4;
          let val = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
          if (invert) val = 1.0 - val;
          if (val >= threshold) {
            ctx.fillRect(x, y, 1.5, 1.5);
            count++;
          }
        }
      }
    }

    setPointCountEst(count * 8);
  }, [mode, threshold, invert, scale]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const handleApplyBake = () => {
    if (!loadedImageRef.current) return;
    setIsProcessing(true);
    try {
      onBakeImage(loadedImageRef.current, {
        mode,
        threshold,
        invert,
        scale,
      });
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="image-glyph-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="image-glyph-modal-window"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-2xl border shadow-2xl p-5 flex flex-col font-mono text-xs ${
          isLight
            ? 'bg-white border-stone-200 text-stone-900 shadow-stone-400/30'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-inherit">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <h2 className="font-bold uppercase tracking-wider text-sm">
              Image to Glyph Form Rasterizer
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-stone-500/10 transition-colors"
          >
            <X className="w-4 h-4 opacity-70" />
          </button>
        </div>

        {/* Body: Drag & Drop + Preview + Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          {/* Left Column: Dropzone & Upload */}
          <div className="flex flex-col gap-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-48 ${
                isLight
                  ? 'border-stone-300 hover:border-cyan-500 bg-stone-50/50 hover:bg-cyan-50/20'
                  : 'border-zinc-700 hover:border-cyan-400 bg-zinc-950/40 hover:bg-cyan-950/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
              />
              <Upload className="w-6 h-6 text-cyan-400 mb-2 opacity-80" />
              <span className="font-semibold text-xs mb-1">
                Drop image here or browse
              </span>
              <span className="text-[10px] opacity-50">
                PNG, JPG, SVG, WebP supported
              </span>
            </div>

            {/* Mode selection buttons */}
            <div>
              <span className="block text-[10px] uppercase opacity-60 mb-1 font-semibold">
                Conversion Algorithm:
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(['edgeSobel', 'luminance', 'silhouette'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-1.5 px-2 rounded border text-[10px] uppercase font-semibold transition-all ${
                      mode === m
                        ? isLight
                          ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                          : 'bg-white text-zinc-950 border-white shadow-xs'
                        : 'border-inherit opacity-70 hover:opacity-100'
                    }`}
                  >
                    {m === 'edgeSobel' ? 'Sobel Edge' : m === 'luminance' ? 'Luminance' : 'Silhouette'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Particle Rasterization Preview */}
          <div className="flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-[10px] opacity-60 mb-1">
              <span>Particle Density Preview</span>
              <span className="font-bold text-cyan-400">~{pointCountEst.toLocaleString()} pts</span>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-inherit bg-black flex items-center justify-center w-full h-48 shadow-inner">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Sliders */}
            <div className="w-full space-y-2 mt-3">
              {/* Threshold */}
              <div>
                <div className="flex justify-between text-[10px] opacity-70 mb-0.5">
                  <span>Threshold</span>
                  <span className="font-bold">{threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.02}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Scale & Invert */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] opacity-70 mb-0.5">
                    <span>Scale</span>
                    <span className="font-bold">{(scale * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={1.5}
                    step={0.05}
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setInvert(!invert)}
                  className={`px-3 py-1.5 rounded border text-[10px] uppercase font-semibold transition-all mt-3 ${
                    invert
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'border-inherit opacity-70 hover:opacity-100'
                  }`}
                >
                  {invert ? 'Inverted' : 'Invert'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-inherit">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-inherit opacity-70 hover:opacity-100 uppercase tracking-wider text-[10px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyBake}
            disabled={isProcessing || !loadedImageRef.current}
            className={`px-5 py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 transition-all shadow-md ${
              isLight
                ? 'bg-stone-900 text-white hover:bg-black'
                : 'bg-white text-zinc-950 hover:bg-zinc-200'
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>Bake into Simulation Targets</span>
          </button>
        </div>
      </div>
    </div>
  );
};
