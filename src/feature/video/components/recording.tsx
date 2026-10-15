import React, { useState, useEffect, useRef } from "react";
import { RecordingStatus } from "@zoom/videosdk";
import { Button, Tooltip } from "antd";
import classNames from "classnames";
import { IconFont } from "../../../component/icon-font";
import { isAllowedParentOrigin } from "../../../utils/parent-origin";

export interface RecordButtonProps {
  text: string;
  tipText: string;
  icon: string;
  hoverIcon: string;
  onClick?: () => void;
}

export const recordStatusIcon = {
  text: "Status",
  tipText: "Record Status",
  icon: "icon-recording-animated",
  hoverIcon: "icon-recording-animated-hover",
};

// Function to get the recording buttons based on status and host status
export const getRecordingButtons = (
  status: RecordingStatus | "",
  isHost: boolean,
) => {
  let buttons: RecordButtonProps[] = [];

  // Define buttons based on the current recording status
  if (status === RecordingStatus.Stopped || status === "") {
    buttons = [
      {
        text: "Record",
        tipText: "Start Recording",
        icon: "icon-recording",
        hoverIcon: "icon-recording-hover",
      },
    ];
  } else if (status === RecordingStatus.Recording) {
    if (!isHost) return [recordStatusIcon]; // If not the host, return the status icon
    buttons = [
      recordStatusIcon,
      {
        text: "Pause",
        tipText: "Pause Recording",
        icon: "icon-recording-pause",
        hoverIcon: "icon-recording-pause-hover",
      },
      {
        text: "Stop",
        tipText: "Stop Recording",
        icon: "icon-recording-stop",
        hoverIcon: "icon-recording-stop-hover",
      },
    ];
  } else if (status === RecordingStatus.Paused) {
    if (!isHost) return [recordStatusIcon]; // If not the host, return the status icon
    buttons = [
      recordStatusIcon,
      {
        text: "Resume",
        tipText: "Resume Recording",
        icon: "icon-recording-resume",
        hoverIcon: "icon-recording-resume-hover",
      },
      {
        text: "Stop",
        tipText: "Stop Recording?",
        icon: "icon-recording-stop",
        hoverIcon: "icon-recording-stop-hover",
      },
    ];
  }

  return buttons; // Return the button array
};

// Recording Button component that handles rendering each button
const RecordingButton = (props: RecordButtonProps) => {
  const { tipText, icon, hoverIcon, onClick } = props;
  const [isHover, setIsHover] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null); // Reference for the button

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      console.log("handlePostMessage", event);

      // Only the Diskus parent (REACT_APP_PARENT_ORIGINS) may control recording
      const fromParent = isAllowedParentOrigin(event.origin);

      if (fromParent && event.data === "Recording") {
        if (buttonRef.current) {
          buttonRef.current.click();
        }
      }

      // Handling various recording-related messages
      if (fromParent) {
        switch (event.data) {
          case "RecordingStartMsgFromIframe":
            console.log("Recording started");
            break;
          case "RecordingResumeMsgFromIframe":
            console.log("Recording resumed");
            break;
          case "RecordingStopMsgFromIframe":
            console.log("Recording stopped");
            break;
          case "RecordingPauseMsgFromIframe":
            console.log("Recording paused");
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("message", handlePostMessage);

    // Cleanup on component unmount
    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  }, []); // Empty dependency array means the effect runs once on mount and cleans up on unmount

  return (
    <Tooltip title={tipText}>
      <Button
        className={classNames("vc-button")}
        icon={<IconFont type={isHover ? hoverIcon : icon} />}
        ghost={true}
        shape="circle"
        size="large"
        onClick={onClick}
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        ref={buttonRef} // Attach the ref here
      />
    </Tooltip>
  );
};

export { RecordingButton };
