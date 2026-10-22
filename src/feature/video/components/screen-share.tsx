import { Button, Tooltip, Dropdown, Modal } from "antd";
import classNames from "classnames";
import { IconFont } from "../../../component/icon-font";
import {
  LockOutlined,
  UnlockOutlined,
  UpOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { SharePrivilege } from "@zoom/videosdk";
import { getAntdDropdownMenu, getAntdItem } from "./video-footer-utils";
import { useEffect, useRef, useState } from "react";
import { isAllowedParentOrigin } from "../../../utils/parent-origin";
import { logVideoError } from "../../../utils/video-log";

const { Button: DropdownButton } = Dropdown;
interface ScreenShareButtonProps {
  sharePrivilege: SharePrivilege;
  isHostOrManager: boolean;
  onSharePrivilegeClick?: (privilege: SharePrivilege) => void;
  onScreenShareClick: () => void;
}

interface ScreenShareLockButtonProps {
  isLockedScreenShare: boolean;
  onScreenShareLockClick: () => void;
}

const ScreenShareButton = (props: ScreenShareButtonProps) => {
  const {
    sharePrivilege,
    isHostOrManager,
    onScreenShareClick,
    onSharePrivilegeClick,
  } = props;

  const [showFirefoxPrompt, setShowFirefoxPrompt] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const needsDirectGesture = isFirefox || isSafari;

  const menu = [
    getAntdItem(
      "Lock share",
      `${SharePrivilege.Locked}`,
      sharePrivilege === SharePrivilege.Locked && <CheckOutlined />,
    ),
    getAntdItem(
      "One participant can share at a time",
      `${SharePrivilege.Unlocked}`,
      sharePrivilege === SharePrivilege.Unlocked && <CheckOutlined />,
    ),
    getAntdItem(
      "Multiple participants can share simultaneously",
      `${SharePrivilege.MultipleShare}`,
      sharePrivilege === SharePrivilege.MultipleShare && <CheckOutlined />,
    ),
  ];

  const onMenuItemClick = (payload: { key: any }) => {
    console.log("handlePostMessage", payload.key);
    onSharePrivilegeClick?.(Number(0));
  };

  // Direct click handler for Firefox/Safari
  const handleDirectScreenShare = () => {
    console.log("Direct screen share button clicked");
    setShowFirefoxPrompt(false);

    try {
      onScreenShareClick();
    } catch (error) {
      console.error("Screen share failed:", error);
      logVideoError("ScreenShare", "share button click failed", error);
    }
  };

  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      console.log(
        "handlePostMessage received:",
        event.data,
        "origin:",
        event.origin,
      );

      // Only the Diskus parent (REACT_APP_PARENT_ORIGINS) may trigger sharing
      if (isAllowedParentOrigin(event.origin) && event.data === "ScreenShare") {
        // For Firefox/Safari - show modal for direct user click
        if (needsDirectGesture) {
          console.log("Firefox/Safari detected - showing direct click modal");
          setShowFirefoxPrompt(true);
        } else {
          // Chrome/Edge - programmatic click works
          console.log("Chrome/Edge - using programmatic click");
          if (buttonRef.current) {
            buttonRef.current.click();
          }
        }
      }
    };

    window.addEventListener("message", handlePostMessage);

    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  }, [needsDirectGesture]);

  return (
    <>
      <Button
        ref={buttonRef}
        className={classNames("screen-share-button", "vc-button")}
        icon={<IconFont type="icon-share" />}
        ghost={true}
        shape="circle"
        size="large"
        onClick={onScreenShareClick}
      />

      {/* Firefox/Safari Modal for Direct User Click */}
      {showFirefoxPrompt && (
        <Modal
          title="Start Screen Share"
          open={showFirefoxPrompt}
          onCancel={() => {
            console.log("Modal cancelled");
            setShowFirefoxPrompt(false);
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                console.log("Cancel button clicked");
                setShowFirefoxPrompt(false);
              }}
            >
              Cancel
            </Button>,
            <Button
              key="share"
              type="primary"
              onClick={handleDirectScreenShare}
            >
              Start Sharing
            </Button>,
          ]}
          destroyOnClose={true}
          maskClosable={false}
        >
          <div style={{ textAlign: "center", padding: "20px" }}>
            <IconFont
              type="icon-share"
              style={{
                fontSize: "48px",
                marginBottom: "16px",
                display: "block",
              }}
            />
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>
              Click "Start Sharing" to begin screen capture
            </p>
            <p style={{ color: "#666", fontSize: "12px" }}>
              Your browser requires a direct click for security purposes
            </p>
          </div>
        </Modal>
      )}
    </>
  );
};

const ScreenShareLockButton = (props: ScreenShareLockButtonProps) => {
  const { isLockedScreenShare, onScreenShareLockClick } = props;
  return (
    <Tooltip
      title={isLockedScreenShare ? "unlock screen share" : " lock screen share"}
    >
      <Button
        className="screen-share-button"
        icon={isLockedScreenShare ? <LockOutlined /> : <UnlockOutlined />}
        ghost={true}
        shape="circle"
        size="large"
        onClick={onScreenShareLockClick}
      />
    </Tooltip>
  );
};

export { ScreenShareButton, ScreenShareLockButton };
