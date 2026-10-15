import { useContext, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { RouteComponentProps } from 'react-router-dom';
import { type VideoPlayer, VideoQuality } from '@zoom/videosdk';
import classnames from 'classnames';
import ZoomContext from '../../context/zoom-context';
import ZoomMediaContext from '../../context/media-context';
import AvatarActionContext from './context/avatar-context';
import Avatar from './components/avatar';
import VideoFooter from './components/video-footer';
import ShareView from './components/share-view';
import RemoteCameraControlPanel from './components/remote-camera-control';
import { useParticipantsChange } from './hooks/useParticipantsChange';
import type { Participant } from '../../index-types';
import { useNetworkQuality } from './hooks/useNetworkQuality';
import { useAvatarAction } from './hooks/useAvatarAction';
import './video.scss';

// Renders video with attachVideo into <video-player> elements. The SDK (2.5+)
// rejects the old canvas-based renderVideo with errorCode 6112 ("Use the
// attachVideo method to render the video"), which left the call black.
const VideoContainer: React.FunctionComponent<RouteComponentProps> = (_props) => {
  const zmClient = useContext(ZoomContext);
  const { mediaStream } = useContext(ZoomMediaContext);
  const shareViewRef = useRef<{ selfShareRef: HTMLCanvasElement | HTMLVideoElement | null }>(null);
  const activeVideoPlayerRef = useRef<VideoPlayer | null>(null);
  const selfVideoPlayerRef = useRef<VideoPlayer | null>(null);
  const [isRecieveSharing, setIsRecieveSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeVideo, setActiveVideo] = useState<number>(mediaStream?.getActiveVideoId() ?? 0);
  const networkQuality = useNetworkQuality(zmClient);

  useParticipantsChange(zmClient, (payload) => {
    setParticipants(payload);
  });
  const onActiveVideoChange = useCallback((payload: any) => {
    const { userId } = payload;
    setActiveVideo(userId);
  }, []);
  useEffect(() => {
    zmClient.on('video-active-change', onActiveVideoChange);
    return () => {
      zmClient.off('video-active-change', onActiveVideoChange);
    };
  }, [zmClient, onActiveVideoChange]);

  const selfUserId = zmClient.getSessionInfo()?.userId;
  const isCurrentUserStartedVideo = !!participants.find((user) => user.userId === selfUserId)?.bVideoOn;

  // active user = `video-active-change` payload, excluding self while self video is on
  // (self video is shown separately in the self view).
  const activeUser = useMemo(
    () => participants.find((user) => user.userId === activeVideo && !(user.userId === selfUserId && user.bVideoOn)),
    [participants, activeVideo, selfUserId]
  );
  const activeVideoUserId = activeUser?.bVideoOn ? activeUser.userId : 0;

  // Main view: attach the active speaker's video
  useEffect(() => {
    const element = activeVideoPlayerRef.current;
    if (!mediaStream || !activeVideoUserId || !element) {
      return undefined;
    }
    mediaStream.attachVideo(activeVideoUserId, VideoQuality.Video_720P, element).catch(() => {});
    return () => {
      try {
        mediaStream.detachVideo(activeVideoUserId, element).catch(() => {});
      } catch {
        // session already closed
      }
    };
  }, [mediaStream, activeVideoUserId]);

  // Self view: attach our own video while the camera is on
  useEffect(() => {
    const element = selfVideoPlayerRef.current;
    if (!mediaStream || !selfUserId || !isCurrentUserStartedVideo || !element) {
      return undefined;
    }
    mediaStream.attachVideo(selfUserId, VideoQuality.Video_720P, element).catch(() => {});
    return () => {
      try {
        mediaStream.detachVideo(selfUserId, element).catch(() => {});
      } catch {
        // session already closed
      }
    };
  }, [mediaStream, selfUserId, isCurrentUserStartedVideo]);

  const avatarActionState = useAvatarAction(zmClient, activeUser ? [activeUser] : []);
  return (
    <div className="viewport">
      <ShareView ref={shareViewRef} onRecieveSharingChange={setIsRecieveSharing} />
      <div
        className={classnames('video-container', 'single-video-container', {
          'video-container-in-sharing': isRecieveSharing
        })}
      >
        <video-player-container class="single-video-wrap">
          {activeVideoUserId ? (
            <video-player
              key={activeVideoUserId}
              class="video-player"
              ref={(element) => {
                activeVideoPlayerRef.current = element;
              }}
            />
          ) : null}

          <AvatarActionContext.Provider value={avatarActionState}>
            {activeUser && (
              <Avatar
                participant={activeUser}
                isActive={false}
                className="single-view-avatar"
                networkQuality={networkQuality[`${activeUser.userId}`]}
              />
            )}
            {zmClient.getSessionInfo()?.isInMeeting && <RemoteCameraControlPanel />}
          </AvatarActionContext.Provider>
        </video-player-container>

        {/* Self view in its own container (outside the speaker's 16:9 box) so
            it can float top-right normally and stack under the speaker in the
            narrow side column while a screen share is shown. */}
        {isCurrentUserStartedVideo && (
          // Plain div owns the position/size; the SDK's container element
          // could otherwise end up in the flex row and split the screen 50/50.
          <div
            className={classnames('self-video', 'self-video-show', {
              'single-self-video': participants.length === 1
            })}
          >
            <video-player-container class="self-video-container">
              <video-player
                class="video-player"
                ref={(element) => {
                  selfVideoPlayerRef.current = element;
                }}
              />
            </video-player-container>
          </div>
        )}
      </div>
      <VideoFooter className="video-operations" sharing selfShareCanvas={shareViewRef.current?.selfShareRef} />
      {/* <ReportBtn /> */}
    </div>
  );
};

export default VideoContainer;
