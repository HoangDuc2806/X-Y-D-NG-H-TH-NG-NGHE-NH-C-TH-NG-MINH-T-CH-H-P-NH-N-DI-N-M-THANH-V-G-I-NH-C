export {};

declare global {
  interface SpotifySdkTrack {
    uri: string;
    id?: string;
    name: string;
    duration_ms: number;
    artists: Array<{ name: string; uri?: string }>;
    album: { name: string; images?: Array<{ url: string }> };
  }

  interface SpotifySdkPlaybackState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: { current_track: SpotifySdkTrack };
  }

  interface SpotifySdkPlayer {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(eventName: string, callback: (payload: any) => void): boolean;
    removeListener(eventName: string, callback?: (payload: any) => void): boolean;
    getCurrentState(): Promise<SpotifySdkPlaybackState | null>;
    seek(positionMs: number): Promise<void>;
    activateElement(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    nextTrack(): Promise<void>;
    previousTrack(): Promise<void>;
    setVolume(volume: number): Promise<void>;
  }

  interface SpotifySdkConstructorOptions {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
    enableMediaSession?: boolean;
  }

  interface Window {
    Spotify?: { Player: new (options: SpotifySdkConstructorOptions) => SpotifySdkPlayer };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}
