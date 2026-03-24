'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Player } from '@/lib/types';

interface VideoChatProps {
  roomId: string;
  playerId: string;
  players: Player[];
  isHost: boolean;
  onMutePlayer?: (targetId: string, isMuted: boolean) => void;
  onBanPlayer?: (targetId: string) => void;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VideoChat({
  roomId, playerId, players, isHost, onMutePlayer, onBanPlayer,
}: VideoChatProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [peers, setPeers] = useState<Record<string, { stream?: MediaStream; name: string }>>({});
  const [expanded, setExpanded] = useState(true);
  const peerConnections = useRef<Record<string, PeerConnection>>({});
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Initialize local media
  async function toggleVideo() {
    if (videoEnabled) {
      localStream?.getVideoTracks().forEach(t => { t.stop(); t.enabled = false; });
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setVideoEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: audioEnabled });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setVideoEnabled(true);
        // Signal other players
        notifyVideoToggle(true);
      } catch (e) {
        console.error('Video access denied', e);
      }
    }
  }

  async function toggleAudio() {
    if (audioEnabled) {
      localStream?.getAudioTracks().forEach(t => t.stop());
      setAudioEnabled(false);
    } else {
      try {
        const stream = localStream || await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!localStream) setLocalStream(stream);
        stream.getAudioTracks().forEach(t => t.enabled = true);
        setAudioEnabled(true);
        notifyVideoToggle(videoEnabled, true);
      } catch (e) {
        console.error('Audio access denied', e);
      }
    }
  }

  async function notifyVideoToggle(hasVideo: boolean, hasAudio?: boolean) {
    try {
      await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'toggle',
          from: playerId,
          to: 'all',
          signal: { hasVideo, hasAudio: hasAudio ?? audioEnabled },
          roomId,
        }),
      });
    } catch {}
  }

  async function sendSignal(to: string, type: string, signal: unknown) {
    try {
      await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, from: playerId, to, signal, roomId }),
      });
    } catch {}
  }

  // Handle incoming WebRTC signals via Pusher (handled in parent)
  const handleSignal = useCallback(async (data: { from: string; signal: unknown; type: string }) => {
    const { from, signal, type } = data;

    if (type === 'offer') {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(from, 'answer', answer);
    } else if (type === 'answer') {
      const pc = peerConnections.current[from]?.pc;
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
    } else if (type === 'ice-candidate') {
      const pc = peerConnections.current[from]?.pc;
      if (pc && signal) {
        try { await pc.addIceCandidate(new RTCIceCandidate(signal as RTCIceCandidateInit)); }
        catch {}
      }
    }
  }, [playerId]);

  function createPeerConnection(remoteId: string): RTCPeerConnection {
    if (peerConnections.current[remoteId]) return peerConnections.current[remoteId].pc;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[remoteId] = { pc, stream: null };

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = event => {
      if (event.candidate) sendSignal(remoteId, 'ice-candidate', event.candidate);
    };

    pc.ontrack = event => {
      const [remoteStream] = event.streams;
      const playerName = players.find(p => p.id === remoteId)?.name || 'Игрок';
      setPeers(prev => ({ ...prev, [remoteId]: { stream: remoteStream, name: playerName } }));
      if (remoteVideoRefs.current[remoteId]) {
        remoteVideoRefs.current[remoteId]!.srcObject = remoteStream;
      }
    };

    return pc;
  }

  async function initiateCall(remoteId: string) {
    if (!localStream) return;
    const pc = createPeerConnection(remoteId);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(remoteId, 'offer', offer);
  }

  const slots = [0, 1, 2, 3].map(seat => players.find(p => p.seatIndex === seat) || null);

  return (
    <div className="video-panel video-panel-root flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer"
        style={{ borderBottom: '1px solid rgba(212,168,67,0.2)' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ color: '#d4a843', fontSize: '0.75rem', fontWeight: 700 }}>📹 Видео</span>
        <span style={{ color: '#6b7c6b', fontSize: '0.7rem' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto p-2">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            {slots.map((slotPlayer, index) => {
              const isLocal = slotPlayer?.id === playerId;
              const displayName = slotPlayer ? (isLocal ? `Вы — ${slotPlayer.name}` : slotPlayer.name) : `Слот ${index + 1}`;
              const hasVideo = isLocal ? videoEnabled : !!slotPlayer?.videoEnabled;
              const hasAudio = isLocal ? audioEnabled : !!slotPlayer?.audioEnabled;
              const hasStream = slotPlayer ? (isLocal ? !!localStream : !!peers[slotPlayer.id]?.stream) : false;

              return (
                <div key={index} className="video-tile" style={{ height: 130 }}>
                  {slotPlayer ? (
                    <>
                      {isLocal ? (
                        <video ref={localVideoRef} autoPlay muted playsInline style={{ transform: 'scaleX(-1)' }} />
                      ) : (
                        <video
                          ref={el => { if (slotPlayer) remoteVideoRefs.current[slotPlayer.id] = el; }}
                          autoPlay
                          playsInline
                        />
                      )}

                      {(!hasVideo || !hasStream) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#111' }}>
                          <span style={{ fontSize: '1.6rem' }}>👤</span>
                          <span style={{ color: '#7a8a7a', fontSize: '0.7rem', marginTop: 4 }}>
                            Камера выключена
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#0c140c' }}>
                      <span style={{ fontSize: '1.6rem' }}>🕒</span>
                      <span style={{ color: '#7a8a7a', fontSize: '0.7rem', marginTop: 4 }}>
                        Ожидание игрока
                      </span>
                    </div>
                  )}

                  <div className="name-tag flex items-center justify-between gap-2">
                    <span className="truncate">{displayName}</span>
                    {slotPlayer && (
                      <span className="flex items-center gap-1">
                        <span title={hasVideo ? 'Камера включена' : 'Камера выключена'}>{hasVideo ? '📹' : '📷'}</span>
                        <span title={hasAudio ? 'Микрофон включен' : 'Микрофон выключен'}>{hasAudio ? '🎙' : '🔇'}</span>
                        {isHost && slotPlayer.id !== playerId && (
                          <span className="flex items-center gap-1 ml-1">
                            <button
                              title="Mute"
                              className="text-xs px-0.5 opacity-70 hover:opacity-100"
                              onClick={e => { e.stopPropagation(); onMutePlayer?.(slotPlayer.id, !slotPlayer.isMuted); }}
                            >
                              {slotPlayer.isMuted ? '🔊' : '🔇'}
                            </button>
                            <button
                              title="Ban"
                              className="text-xs px-0.5 opacity-70 hover:opacity-100"
                              onClick={e => { e.stopPropagation(); onBanPlayer?.(slotPlayer.id); }}
                            >
                              🚫
                            </button>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-1 p-1.5" style={{ borderTop: '1px solid rgba(212,168,67,0.15)' }}>
        <button
          className={`flex-1 py-1 rounded text-xs font-semibold transition-all ${videoEnabled ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleVideo}
          style={{ fontSize: '0.7rem' }}
        >
          {videoEnabled ? '📹 Вкл' : '📷 Выкл'}
        </button>
        <button
          className={`flex-1 py-1 rounded text-xs font-semibold transition-all ${audioEnabled ? 'btn-primary' : 'btn-secondary'}`}
          onClick={toggleAudio}
          style={{ fontSize: '0.7rem' }}
        >
          {audioEnabled ? '🎙 Вкл' : '🔇 Выкл'}
        </button>
      </div>
    </div>
  );
}
