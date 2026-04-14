import React from "react";
import {AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame} from "remotion";
import {staticFile} from "remotion";

interface BrollOverlayProps {
  src: string;
  durationInFrames: number;
  isImage?: boolean;
  transition?: string;
}

export const BrollOverlay: React.FC<BrollOverlayProps> = ({src, durationInFrames, isImage, transition = "fade"}) => {
  const frame = useCurrentFrame();
  const fadeFrames = 15;

  // Opacity for fade transition (always used as base for slide/wipe too)
  const fadeOpacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"}
  );

  // Ken Burns: slow zoom + pan
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });
  const translateKB = interpolate(frame, [0, durationInFrames], [0, 20], {
    extrapolateRight: "clamp",
  });

  // Transition-specific transforms
  let containerStyle: React.CSSProperties = {};

  if (transition === "slide") {
    const enterX = interpolate(frame, [0, fadeFrames], [100, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    const exitX = interpolate(frame, [durationInFrames - fadeFrames, durationInFrames], [0, -100], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    const xPos = frame < fadeFrames ? enterX : (frame > durationInFrames - fadeFrames ? exitX : 0);
    containerStyle = {
      opacity: 1,
      transform: `translateX(${xPos}%)`,
    };
  } else if (transition === "wipe") {
    const enterClip = interpolate(frame, [0, fadeFrames], [0, 100], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    const exitClip = interpolate(frame, [durationInFrames - fadeFrames, durationInFrames], [100, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
    const clipPct = frame < fadeFrames ? enterClip : (frame > durationInFrames - fadeFrames ? exitClip : 100);
    containerStyle = {
      opacity: 1,
      clipPath: `inset(0 ${100 - clipPct}% 0 0)`,
    };
  } else {
    // Default fade
    containerStyle = {
      opacity: fadeOpacity,
    };
  }

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    transform: `scale(${scale}) translateX(${translateKB}px)`,
  };

  return (
    <AbsoluteFill style={containerStyle}>
      {isImage ? (
        <Img src={staticFile(src)} style={mediaStyle} />
      ) : (
        <OffthreadVideo src={staticFile(src)} style={mediaStyle} />
      )}
    </AbsoluteFill>
  );
};
