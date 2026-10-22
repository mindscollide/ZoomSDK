import {
  type HTMLAttributes,
  type DetailedHTMLProps,
  type DOMAttributes,
  useEffect,
  useContext,
  useState,
  useCallback,
  useReducer,
  useMemo
} from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import ZoomVideo, {
  type VideoPlayerContainer,
  type VideoPlayer,
  ConnectionState,
  ReconnectReason
} from '@zoom/videosdk';
import { Button, message, Modal, Result } from 'antd';
import 'antd/dist/antd.min.css';
import produce from 'immer';
import Home from './feature/home/home';
import Video from './feature/video/video';
import VideoSingle from './feature/video/video-single';
import VideoAttach from './feature/video/video-attach';
import Preview from './feature/preview/preview';
import ZoomContext from './context/zoom-context';
import ZoomMediaContext from './context/media-context';
import LoadingLayer from './component/loading-layer';
import { logVideoError } from './utils/video-log';
import Chat from './feature/chat/chat';
import Command from './feature/command/command';
import Subsession from './feature/subsession/subsession';
import type { MediaStream } from './index-types';
import './App.css';
type CustomElement<T> = Partial<T & DOMAttributes<T> & { children: any }>;

interface AppProps {
  meetingArgs: {
    sdkKey: string;
    topic: string;
    signature: string;
    name: string;
    password?: string;
    webEndpoint?: string;
    enforceGalleryView?: string;
    enforceVB?: string;
    customerJoinId?: string;
    lang?: string;
    useVideoPlayer?: string;
  };
}
const mediaShape = {
  audio: {
    encode: false,
    decode: false
  },
  video: {
    encode: false,
    decode: false
  },
  share: {
    encode: false,
    decode: false
  }
};
const mediaReducer = produce((draft, action) => {
  switch (action.type) {
    case 'audio-encode': {
      draft.audio.encode = action.payload;
      break;
    }
    case 'audio-decode': {
      draft.audio.decode = action.payload;
      break;
    }
    case 'video-encode': {
      draft.video.encode = action.payload;
      break;
    }
    case 'video-decode': {
      draft.video.decode = action.payload;
      break;
    }
    case 'share-encode': {
      draft.share.encode = action.payload;
      break;
    }
    case 'share-decode': {
      draft.share.decode = action.payload;
      break;
    }
    case 'reset-media': {
      Object.assign(draft, { ...mediaShape });
      break;
    }
    default:
      break;
  }
}, mediaShape);

// Generous limits: the first load downloads several MB of SDK files, and a
// false timeout would abandon a join that was about to succeed.
const SDK_INIT_TIMEOUT_MS = 90000;
const SDK_JOIN_TIMEOUT_MS = 60000;

declare global {
  interface Window {
    webEndpoint: string | undefined;
    zmClient: any | undefined;
    mediaStream: any | undefined;
    crossOriginIsolated: boolean;
    ltClient: any | undefined;
    logClient: any | undefined;
  }
  namespace JSX {
    interface IntrinsicElements {
      ['video-player']: DetailedHTMLProps<HTMLAttributes<VideoPlayer>, VideoPlayer> & { class?: string };
      ['video-player-container']: CustomElement<VideoPlayerContainer> & { class?: string };
    }
  }
}

function App(props: AppProps) {
  const {
    meetingArgs: {
      sdkKey,
      topic,
      signature,
      name,
      password,
      webEndpoint: webEndpointArg,
      enforceGalleryView,
      enforceVB,
      customerJoinId,
      lang,
      useVideoPlayer
    }
  } = props;
  const [loading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('');
  const [isFailover, setIsFailover] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('closed');
  const [mediaState, dispatch] = useReducer(mediaReducer, mediaShape);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isSupportGalleryView, setIsSupportGalleryView] = useState<boolean>(false);
  // Set when the SDK fails to load or join; replaces the loader with a Retry screen.
  const [startError, setStartError] = useState<string>('');
  const zmClient = useContext(ZoomContext);
  let webEndpoint: any;
  if (webEndpointArg) {
    webEndpoint = webEndpointArg;
  } else {
    webEndpoint = window?.webEndpoint ?? 'zoom.us';
  }
  const mediaContext = useMemo(() => ({ ...mediaState, mediaStream }), [mediaState, mediaStream]);
  const galleryViewWithoutSAB = Number(enforceGalleryView) === 1 && !window.crossOriginIsolated;
  const vbWithoutSAB = Number(enforceVB) === 1 && !window.crossOriginIsolated;
  const galleryViewWithAttach = Number(useVideoPlayer) === 1 && (window.crossOriginIsolated || galleryViewWithoutSAB);

  if (galleryViewWithAttach) {
    console.log({
      galleryViewWithAttach,
      use: '<video-player-container> video tag render video',
      doc: 'https://marketplacefront.zoom.us/sdk/custom/web/modules/Stream.html#attachVideo'
    });
  } else {
    console.log({
      galleryViewWithAttach,
      use: '<canvas>',
      doc: 'https://marketplacefront.zoom.us/sdk/custom/web/modules/Stream.html#startVideo'
    });
  }
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Rejects if `promise` hasn't settled within `ms`, so a hung SDK step shows
    // an error instead of an endless loader.
    const withTimeout = <T,>(promise: Promise<T>, ms: number, step: string) =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timers.push(setTimeout(() => reject({ reason: `${step} timed out` }), ms));
        })
      ]);
    const init = async () => {
      try {
        setLoadingText('Loading video...');
        // Versioned path: see scripts/zoom-sdk-lib.js.
        await withTimeout(
          zmClient.init('en-US', `${window.location.origin}/lib/${process.env.REACT_APP_ZOOM_SDK_VERSION}`, {
            webEndpoint,
            enforceMultipleVideos: galleryViewWithoutSAB,
            enforceVirtualBackground: vbWithoutSAB,
            stayAwake: true,
            patchJsMedia: true,
            leaveOnPageUnload: true,
          }),
          SDK_INIT_TIMEOUT_MS,
          'Loading video'
        );
        if (cancelled) return;
        setLoadingText('Joining the session...');
        await withTimeout(zmClient.join(topic, signature, name, password), SDK_JOIN_TIMEOUT_MS, 'Joining the session');
        if (cancelled) return;
        const stream = zmClient.getMediaStream();
        setMediaStream(stream);
        setIsSupportGalleryView(stream.isSupportMultipleVideos());
        setIsLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        logVideoError('Start', `SDK init/join failed: ${e?.reason || e?.message || 'unknown'}`, e);
        setStartError(e?.reason || e?.message || 'Could not start the video.');
      }
    };
    init();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      if (zmClient.getSessionInfo()?.isInMeeting) {
        ZoomVideo.destroyClient();
      }
    };
  }, [
    sdkKey,
    signature,
    zmClient,
    topic,
    name,
    password,
    webEndpoint,
    galleryViewWithoutSAB,
    customerJoinId,
    lang,
    vbWithoutSAB
  ]);
  const onConnectionChange = useCallback(
    (payload: any) => {
      if (payload.state === ConnectionState.Reconnecting) {
        setIsLoading(true);
        setIsFailover(true);
        setStatus('connecting');
        const { reason, subsessionName } = payload;
        if (reason === ReconnectReason.Failover) {
          logVideoError('Connection', 'connection lost, reconnecting', payload);
        }
        if (reason === ReconnectReason.Failover) {
          setLoadingText('Session Disconnected,Try to reconnect');
        } else if (reason === ReconnectReason.JoinSubsession || reason === ReconnectReason.MoveToSubsession) {
          setLoadingText(`Joining ${subsessionName}...`);
        } else if (reason === ReconnectReason.BackToMainSession) {
          setLoadingText('Returning to Main Session...');
        }
      } else if (payload.state === ConnectionState.Connected) {
        setStatus('connected');
        if (isFailover) {
          setIsLoading(false);
        }
        window.zmClient = zmClient;
        window.mediaStream = zmClient.getMediaStream();
        window.parent.postMessage('StreamConnected', '*'); // Notify parent window

        console.log('getSessionInfo', zmClient.getSessionInfo());
        // One-line capability report: screen share rendering needs WebGL here,
        // and Safari (e.g. Lockdown Mode) can have it disabled.
        try {
          const probe = document.createElement('canvas');
          console.warn('[ZoomSDK] capabilities', {
            webgl: !!probe.getContext('webgl'),
            webgl2: !!document.createElement('canvas').getContext('webgl2'),
            crossOriginIsolated: window.crossOriginIsolated,
            userAgent: navigator.userAgent
          });
        } catch (e) {
          console.warn('[ZoomSDK] capabilities check failed', e);
        }
      } else if (payload.state === ConnectionState.Closed || payload.state === ConnectionState.Fail) {
        setStatus('closed');
        dispatch({ type: 'reset-media' });
        if (payload.state === ConnectionState.Fail) {
          logVideoError('Connection', `session connection failed: ${payload.reason ?? 'no reason given'}`, payload);
          Modal.error({
            title: 'Join meeting failed',
            content: `Join meeting failed. reason:${payload.reason ?? ''}`
          });
        }
        if (payload.reason === 'ended by host') {
          Modal.warning({
            title: 'Meeting ended',
            content: 'This meeting has been ended by host'
          });
        }
      }
    },
    [isFailover, zmClient]
  );
  const onMediaSDKChange = useCallback((payload: any) => {
    const { action, type, result } = payload;
    if (result === 'fail') {
      logVideoError('Media', `${type} ${action} worker failed to start`, payload);
    }
    dispatch({ type: `${type}-${action}`, payload: result === 'success' });
  }, []);
  const onDevicePermissionChange = useCallback((payload: any) => {
    if (payload?.state === 'denied') {
      logVideoError('Permission', `${payload.name} permission denied`, payload);
    }
  }, []);
  const onAutoPlayAudioFailed = useCallback(() => {
    logVideoError('Media', 'browser blocked audio autoplay (user must click to hear audio)');
  }, []);

  const onLeaveOrJoinSession = useCallback(async () => {
    if (status === 'closed') {
      setIsLoading(true);
      await zmClient.join(topic, signature, name, password);
      setIsLoading(false);
    } else if (status === 'connected') {
      await zmClient.leave();
      message.warn('You have left the session.');
    }
  }, [zmClient, status, topic, signature, name, password]);

  useEffect(() => {
    zmClient.on('connection-change', onConnectionChange);
    zmClient.on('media-sdk-change', onMediaSDKChange);
    zmClient.on('device-permission-change', onDevicePermissionChange);
    zmClient.on('auto-play-audio-failed', onAutoPlayAudioFailed);
    return () => {
      zmClient.off('connection-change', onConnectionChange);
      zmClient.off('media-sdk-change', onMediaSDKChange);
      zmClient.off('device-permission-change', onDevicePermissionChange);
      zmClient.off('auto-play-audio-failed', onAutoPlayAudioFailed);
    };
  }, [zmClient, onConnectionChange, onMediaSDKChange, onDevicePermissionChange, onAutoPlayAudioFailed]);
  console.log({ isSupportGalleryView, galleryViewWithAttach });

  return (
    <div className="App">
      {startError && (
        <div className="loading-layer start-error">
          <Result
            status="error"
            title="Video could not start"
            subTitle={startError}
            extra={
              // A reload starts the SDK from scratch, which a second init() on the same client would not.
              <Button type="primary" onClick={() => window.location.reload()}>
                Retry
              </Button>
            }
          />
        </div>
      )}
      {!startError && loading && <LoadingLayer content={loadingText} />}
      {!startError && !loading && (
        <ZoomMediaContext.Provider value={mediaContext}>
          <Router>
            <Switch>
              {/* <Route
                path="/"
                render={(props) => <Home {...props} status={status} onLeaveOrJoinSession={onLeaveOrJoinSession} />}
                exact
              />
              <Route path="/index.html" component={Home} exact />
              <Route path="/chat" component={Chat} />
              <Route path="/command" component={Command} /> */}
              <Route path="/" component={VideoSingle} />1
              {/* <Route path="/subsession" component={Subsession} />
              <Route path="/preview" component={Preview} /> */}
            </Switch>
          </Router>
        </ZoomMediaContext.Provider>
      )}
    </div>
  );
}

export default App;
