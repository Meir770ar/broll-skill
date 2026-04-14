import React, {useState, useEffect} from "react";
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, useCurrentFrame, delayRender, continueRender, staticFile} from "remotion";
import {BrollOverlay} from "./components/BrollOverlay";
import {TalkingHeadPIP} from "./components/TalkingHeadPIP";
import {Captions} from "./components/Captions";
import "./fonts";

interface BrollSegment {
  src: string;
  startFrame: number;
  endFrame: number;
  isImage?: boolean;
  transition?: string;
}

interface CaptionSegment {
  text: string;
  startFrame: number;
  endFrame: number;
  highlight?: boolean;
}

interface TalkingHeadBrollProps {
  talkingHeadSrc: string;
  broll?: BrollSegment[];
  captions?: CaptionSegment[];
  showCaptions?: boolean;
  pipSize?: number;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  pipPosition?: string;
  mood?: string;
  musicSrc?: string | null;
  style?: 'pip' | 'fullscreen';
}

export const TalkingHeadBroll: React.FC<TalkingHeadBrollProps> = ({
  talkingHeadSrc,
  broll = [],
  captions = [],
  showCaptions = true,
  pipSize = 280,
  mood,
  musicSrc,
  style = 'pip',
}) => {
  const frame = useCurrentFrame();
  
  const [fontHandle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load("bold 84px Assistant"),
    ]).then(() => continueRender(fontHandle))
      .catch(() => continueRender(fontHandle));
  }, [fontHandle]);

  return (
    <AbsoluteFill style={{backgroundColor: "black"}}>
      {/* Layer 0: Background music — Lyria-generated if available, else stock by mood */}
      {musicSrc ? (
        <Audio src={staticFile(musicSrc)} volume={0.25} loop />
      ) : mood ? (
        <Audio src={staticFile(`music/${mood}.mp3`)} volume={0.4} loop />
      ) : null}

      {/* Layer 1: Talking Head fullscreen (always playing) */}
      {talkingHeadSrc && (
        <OffthreadVideo
          src={staticFile(talkingHeadSrc)}
          style={{width: "100%", height: "100%", objectFit: "cover"}}
        />
      )}

      {/* Layer 2: B-roll overlays */}
      {broll.map((segment, i) => (
        <Sequence
          key={`broll-${i}`}
          from={segment.startFrame}
          durationInFrames={segment.endFrame - segment.startFrame}
        >
          <BrollOverlay
            src={segment.src}
            durationInFrames={segment.endFrame - segment.startFrame}
            isImage={segment.isImage}
            transition={segment.transition}
          />
        </Sequence>
      ))}

      {/* Layer 3: PIP (talking head small, only during B-roll) — only in 'pip' style */}
      {style === 'pip' && broll.map((segment, i) => (
        <Sequence
          key={`pip-${i}`}
          from={segment.startFrame}
          durationInFrames={segment.endFrame - segment.startFrame}
        >
          <TalkingHeadPIP
            src={staticFile(talkingHeadSrc)}
            startFrom={segment.startFrame}
            size={pipSize}
          />
        </Sequence>
      ))}

      {/* Layer 4: Captions */}
      {showCaptions &&
        captions.map((cap, i) => (
          <Sequence
            key={`cap-${i}`}
            from={cap.startFrame}
            durationInFrames={cap.endFrame - cap.startFrame}
          >
            <Captions text={cap.text} highlight={cap.highlight} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
