import React from "react";
import {Composition} from "remotion";
import {TalkingHeadBroll} from "./TalkingHeadBroll";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TalkingHeadBroll"
        component={TalkingHeadBroll}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          talkingHeadSrc: "",
          durationInFrames: 300,
          fps: 30,
          width: 1080,
          height: 1920,
          broll: [],
          captions: [],
          showCaptions: true,
          pipSize: 280,
          pipPosition: "bottom-right",
          mood: "calm",
        }}
        calculateMetadata={async ({props}) => {
          return {
            durationInFrames: props.durationInFrames || 300,
            width: props.width || 1080,
            height: props.height || 1920,
            fps: props.fps || 30,
          };
        }}
      />
    </>
  );
};
