'use client';

export default function DownloadPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse at center, #1a1b1f 0%, #0f1013 100%)' }}>
      <div className="w-full max-w-xl modal-box">
        <h1 style={{ fontFamily: 'Playfair Display, serif', color: '#e3c17a', fontSize: '2rem' }}>📲 Скачать Belka (Max edition)</h1>
        <p style={{ color: '#a0b09a', marginTop: 8 }}>
          Android: прямой APK. iOS: пока только через браузер.
        </p>

        <div className="mt-6 space-y-3">
          <a className="btn-primary w-full text-center block" href="/apk/belka-max.apk">
            Скачать APK (Android)
          </a>
          <a className="btn-secondary w-full text-center block" href="/">
            Играть в браузере
          </a>
        </div>

        <div className="mt-6 text-sm" style={{ color: '#6b7c6b' }}>
          Для установки APK нужно разрешить установку из неизвестных источников в настройках Android.
        </div>
      </div>
    </div>
  );
}
