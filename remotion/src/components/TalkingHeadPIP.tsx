import React from "react";
import {OffthreadVideo} from "remotion";

export const TalkingHeadPIP: React.FC<{src: string; startFrom: number; size?: number}> = ({src, startFrom, size = 280}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        right: 40,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "4px solid white",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
};
