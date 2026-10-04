"use client";

import { type PointerEventHandler, type Ref } from "react";
import { type Asset, type Settings, backgroundCSS, cardBox, hexToRgba, PERSPECTIVE, visibleRect } from "@/lib/editor-state";

interface ArtboardProps {
  settings: Settings;
  asset: Asset;
  artboardRef: Ref<HTMLDivElement>;
  dragging: boolean;
  adjusting: boolean;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
}

export function Artboard({ settings: s, asset, artboardRef, dragging, adjusting, onPointerDown, onPointerMove, onPointerUp }: ArtboardProps) {
  const { width, height, unit, chrome, bar, inset, cardWidth, cardHeight } = cardBox(s, asset);
  const dot = { width: 9 * chrome, height: 9 * chrome };
  const image = visibleRect(asset);
  const k = (cardWidth - inset * 2) / image.width;

  return <div ref={artboardRef} className="artboard" style={{ width, height, background: backgroundCSS(s) }}>
    <div className={`shot ${dragging ? "is-dragging" : ""} ${adjusting ? "is-adjusting" : ""}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onLostPointerCapture={onPointerUp}
      style={{
        width: cardWidth, height: cardHeight,
        left: width / 2 + s.x / 100 * width, top: height / 2 + s.y / 100 * height, marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2,
        borderRadius: s.radius * unit, background: s.frame === "dark" ? "#292a30" : "#ffffff",
        boxShadow: s.shadow > 0 ? `${s.shadowX * unit}px ${s.shadowY * unit}px ${s.shadowBlur * unit}px ${s.shadowSpread * unit}px ${hexToRgba(s.shadowColor, s.shadow / 100)}` : "none",
        transform: `perspective(${width * PERSPECTIVE}px) rotateX(${s.tiltX}deg) rotateY(${s.tiltY}deg) rotateZ(${s.rotation}deg)`,
      }}>
      {s.frame !== "none" && <div className={`shot-bar ${s.frame}`} style={{ height: bar, padding: `0 ${14 * chrome}px`, gap: 7 * chrome }}>
        <span style={{ ...dot, background: "#ff625a" }} /><span style={{ ...dot, background: "#ffbd44" }} /><span style={{ ...dot, background: "#00c84e" }} />
      </div>}
      <div style={{ padding: inset, lineHeight: 0 }}>
        <div className="shot-crop" style={{ position: "relative", overflow: "hidden", height: image.height * k, borderRadius: inset ? Math.max(0, s.radius * unit - inset) : 0 }}>
          <img className="shot-image" src={asset.src} alt={asset.name} draggable={false}
            style={{ position: "absolute", left: -image.x * k, top: -image.y * k, width: asset.width * k, height: asset.height * k, maxWidth: "none" }} />
        </div>
      </div>
    </div>
  </div>;
}
