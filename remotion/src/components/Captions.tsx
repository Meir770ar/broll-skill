import React from "react";
import {interpolate, useCurrentFrame} from "remotion";
import "../fonts";

interface CaptionsProps {
  text: string;
  highlight?: boolean;
}

export const Captions: React.FC<CaptionsProps> = ({text, highlight = false}) => {
  const frame = useCurrentFrame();

  // Pop-in animation: scale 0.5->1.0 over 5 frames + opacity 0->1
  const opacity = interpolate(frame, [0, 5], [0, 1], {extrapolateRight: "clamp"});
  const scale = interpolate(frame, [0, 5], [0.5, 1.0], {extrapolateRight: "clamp"});

  const fontSize = highlight ? 84 : 72;
  const color = highlight ? "#FFD700" : "white";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 200,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <span
        style={{
          fontFamily: "Assistant, sans-serif",
          fontSize,
          fontWeight: "bold",
          color,
          textShadow: "0 4px 12px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.5)",
          direction: "rtl",
          padding: "12px 32px",
          letterSpacing: highlight ? 2 : 0,
        }}
      >
        {text}
      </span>
    </div>
  );
};
