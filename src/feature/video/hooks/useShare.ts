import { useState, useCallback, useEffect, MutableRefObject } from 'react';
import type { VideoPlayer } from '@zoom/videosdk';
import { ZoomClient, MediaStream, Participant } from '../../../index-types';
export function useShare(
  zmClient: ZoomClient,
  mediaStream: MediaStream | null,
  shareRef: MutableRefObject<VideoPlayer | null>
) {
  const [isRecieveSharing, setIsReceiveSharing] = useState(false);
  const [isStartedShare, setIsStartedShare] = useState(false);
  const [activeSharingId, setActiveSharingId] = useState(0);
  const [sharedContentDimension, setSharedContentDimension] = useState({
    width: 0,
    height: 0
  });
  const [sharUserList, setShareUserId] = useState<Array<Participant> | undefined>(mediaStream?.getShareUserList());
  const onActiveShareChange = useCallback(
    ({ state, userId }: any) => {
      if (!isStartedShare) {
        setActiveSharingId(userId);
        setIsReceiveSharing(state === 'Active');
      }
    },
    [isStartedShare]
  );
  const onSharedContentDimensionChange = useCallback(({ width, height }: any) => {
    setSharedContentDimension({ width, height });
  }, []);
  const onPeerShareChange = useCallback(() => {
    if (mediaStream) {
      setShareUserId(mediaStream.getShareUserList());
    }
  }, [mediaStream]);
  const onCurrentUserUpdate = useCallback(
    (payload: any) => {
      if (Array.isArray(payload) && payload.length > 0) {
        payload.forEach((item) => {
          if (item.userId === zmClient.getSessionInfo().userId && item.sharerOn !== undefined) {
            setIsStartedShare(item.sharerOn);
            if (item.sharerOn) {
              setIsReceiveSharing(false);
            }
            if (mediaStream) {
              setShareUserId(mediaStream.getShareUserList());
            }
          }
        });
      }
    },
    [zmClient, mediaStream]
  );
  const onShareContentChange = useCallback((payload: any) => {
    setActiveSharingId(payload.userId);
  }, []);
  const onActiveMediaFailed = useCallback((payload: any) => {
    // "Active media failed" popup intentionally suppressed.
    // The Zoom Video SDK can emit `active-media-failed` repeatedly (notably on
    // Safari, and when the camera is toggled during 1:1 / group calls). The
    // previous Modal.error stacked a new dialog on every emission and forced a
    // page reload, which the user experienced as a continuous popup loop.
    // We log it (with the SDK's failure code) for diagnostics instead.
    const codeNames: Record<number, string> = {
      201: 'VideoConnectionFailed',
      202: 'VideoStreamEnded',
      203: 'CameraPermissionReset',
      204: 'WebGlContextInvalid',
      205: 'WasmOutOfMemory',
      206: 'VideoStreamFailed',
      207: 'VideoStreamMuted',
      301: 'SharingStreamFailed'
    };
    const code = payload?.code;
    console.warn(
      `[ZoomSDK] active-media-failed code=${code} (${codeNames[code] ?? 'unknown'}) (popup suppressed)`,
      payload
    );
  }, []);
  useEffect(() => {
    zmClient.on('active-share-change', onActiveShareChange);
    zmClient.on('share-content-dimension-change', onSharedContentDimensionChange);
    zmClient.on('user-updated', onCurrentUserUpdate);
    zmClient.on('peer-share-state-change', onPeerShareChange);
    zmClient.on('share-content-change', onShareContentChange);
    zmClient.on('active-media-failed', onActiveMediaFailed);
    return () => {
      zmClient.off('active-share-change', onActiveShareChange);
      zmClient.off('share-content-dimension-change', onSharedContentDimensionChange);
      zmClient.off('user-updated', onCurrentUserUpdate);
      zmClient.off('peer-share-state-change', onPeerShareChange);
      zmClient.off('share-content-change', onShareContentChange);
      zmClient.off('active-media-failed', onActiveMediaFailed);
    };
  }, [
    zmClient,
    onActiveShareChange,
    onSharedContentDimensionChange,
    onCurrentUserUpdate,
    onPeerShareChange,
    onShareContentChange,
    onActiveMediaFailed
  ]);
  // Render the received share with attachShareView into a <video-player>. The
  // canvas-based startShareView is deprecated in SDK 2.5 and draws nothing when
  // media runs over WebRTC (Safari/Mac), so viewers saw an empty share.
  // The cleanup detaches when sharing stops, the sharer changes, or on unmount.
  useEffect(() => {
    const element = shareRef.current;
    if (!mediaStream || !isRecieveSharing || !activeSharingId || !element) {
      return undefined;
    }
    mediaStream.attachShareView(activeSharingId, element).catch(() => {});
    return () => {
      try {
        mediaStream.detachShareView(activeSharingId, element).catch(() => {});
      } catch {
        // session already closed
      }
    };
  }, [mediaStream, shareRef, isRecieveSharing, activeSharingId]);
  useEffect(() => {
    if (mediaStream) {
      const activeSharedUserId = mediaStream.getActiveShareUserId();
      if (activeSharedUserId) {
        setIsReceiveSharing(true);
        setActiveSharingId(activeSharedUserId);
      }
    }
  }, [mediaStream]);
  return { isRecieveSharing, isStartedShare, sharedContentDimension, sharUserList, activeSharingId };
}
