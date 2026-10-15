import { useRef, useContext, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { VideoPlayer } from '@zoom/videosdk';
import classnames from 'classnames';
import Draggable from 'react-draggable';
import _ from 'lodash';
import ZoomContext from '../../../context/zoom-context';
import ZoomMediaContext from '../../../context/media-context';
import ShareBar from './share-bar';
import ShareIndicationBar from './share-indication';

import { useShare } from '../hooks/useShare';
import { useRemoteControl } from '../hooks/useRemoteControl';
import { useMount, useSizeCallback } from '../../../hooks';

import './share-view.scss';
import { ShareViewType } from '../video-constants';
interface ShareViewProps {
  className?: string;
  onRecieveSharingChange: (isSharing: boolean) => void;
}
const DragThreshod = 50;
const ShareView = forwardRef((props: ShareViewProps, ref: any) => {
  const { onRecieveSharingChange } = props;
  const zmClient = useContext(ZoomContext);
  const { mediaStream } = useContext(ZoomMediaContext);
  const selfShareViewRef = useRef<(HTMLCanvasElement & HTMLVideoElement) | null>(null);
  const shareViewRef = useRef<VideoPlayer | null>(null);
  const shareViewContainerRef = useRef<HTMLDivElement | null>(null);
  const shareViewViewportRef = useRef<HTMLDivElement | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [shareViewSize, setShareViewSize] = useState({ width: 0, height: 0 });
  const [viewType, setViewType] = useState<string>(ShareViewType.FitWindow);
  const [originalViewPosition, setOriginalViewPosition] = useState({ x: 0, y: 0 });
  const debounceRef = useRef(_.debounce(setContainerSize, 300));
  const { isRecieveSharing, sharedContentDimension, sharUserList, activeSharingId } = useShare(
    zmClient,
    mediaStream,
    shareViewRef
  );
  const { isControllingUser, controllingUser } = useRemoteControl(
    zmClient,
    mediaStream,
    selfShareViewRef.current,
    shareViewRef.current
  );

  const onContainerResize = useCallback(({ width, height }: any) => {
    if (shareViewContainerRef.current) {
      debounceRef.current({ width, height });
    }
  }, []);
  useMount(() => {
    if (shareViewContainerRef.current) {
      const { width, height } = shareViewContainerRef.current.getBoundingClientRect();
      setContainerSize({ width, height });
    }
  });
  useSizeCallback(shareViewContainerRef.current, onContainerResize);
  const onShareViewDrag = useCallback(
    (_event: any, { x, y }: any) => {
      const { width, height } = sharedContentDimension;
      const { width: vWidth, height: vHeight } = shareViewSize;
      setOriginalViewPosition((payload) => {
        let nX = payload.x;
        let nY = payload.y;
        if ((x < 0 && Math.abs(x) < width - DragThreshod) || (x > 0 && x < vWidth - DragThreshod)) {
          nX = x;
        }
        if ((y < 0 && Math.abs(y) < height - DragThreshod) || (y > 0 && y < vHeight - DragThreshod)) {
          nY = y;
        }
        return {
          x: nX,
          y: nY
        };
      });
    },
    [sharedContentDimension, shareViewSize]
  );

  useEffect(() => {
    if (
      isRecieveSharing &&
      shareViewContainerRef.current &&
      containerSize.width > 0 &&
      sharedContentDimension.width > 0
    ) {
      const { width, height } = sharedContentDimension;
      const { width: containerWidth, height: containerHeight } = containerSize;
      if (viewType === ShareViewType.FitWindow) {
        const ratio = Math.min(containerWidth / width, containerHeight / height, 1);
        setShareViewSize({
          width: Math.floor(width * ratio),
          height: Math.floor(height * ratio)
        });
      } else if (viewType === ShareViewType.OriginalSize) {
        setShareViewSize({
          width,
          height
        });
      }
    } else {
      setShareViewSize({ width: 0, height: 0 });
    }
  }, [isRecieveSharing, sharedContentDimension, containerSize, viewType]);

  // The share is now drawn in a <video-player> sized by CSS to the viewport, so
  // the canvas-only updateSharingCanvasDimension call is no longer needed.
  useImperativeHandle(ref, () => {
    return {
      selfShareRef: selfShareViewRef.current
    };
  }, []);
  useEffect(() => {
    onRecieveSharingChange(isRecieveSharing);
  }, [isRecieveSharing, onRecieveSharingChange]);
  console.log('handlePostMessagehandlePostMessage viewType', viewType);
  console.log('handlePostMessagehandlePostMessage viewType', isControllingUser);
  console.log('handlePostMessagehandlePostMessage isRecieveSharing', isRecieveSharing);
  return (
    <>
      <ShareBar ref={selfShareViewRef} controllingUser={controllingUser} />
      <div
        className={classnames('share-view', {
          'share-view-in-sharing': isRecieveSharing,
          'share-view-original': isRecieveSharing && viewType === ShareViewType.OriginalSize
        })}
        ref={shareViewContainerRef}
      >
        {isRecieveSharing && (
          <ShareIndicationBar
            sharUserList={sharUserList}
            activeSharingId={activeSharingId}
            isControllingUser={isControllingUser}
            viewType={viewType}
            setViewType={setViewType}
          />
        )}
        <Draggable
          nodeRef={shareViewViewportRef}
          disabled={isControllingUser || viewType !== ShareViewType.OriginalSize}
          position={viewType === ShareViewType.OriginalSize ? originalViewPosition : { x: 0, y: 0 }}
          onDrag={onShareViewDrag}
        >
          <div
            className={classnames('share-view-viewport', {
              'share-view-viewport-original': viewType === ShareViewType.OriginalSize,
              'share-view-viewport-in-control': isControllingUser
            })}
            style={{
              width: `${shareViewSize.width}px`,
              height: `${shareViewSize.height}px`
            }}
            ref={shareViewViewportRef}
          >
            {/* Own container: the SDK forbids sharing one with attachVideo */}
            <video-player-container class="share-view-player-container">
              <video-player
                class="share-view-player"
                ref={(element) => {
                  shareViewRef.current = element;
                }}
              />
            </video-player-container>
          </div>
        </Draggable>
      </div>
    </>
  );
});

export default ShareView;
