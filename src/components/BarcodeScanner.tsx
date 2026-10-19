import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Icon } from './ui';

/** Camera barcode scanner (EAN/UPC/Code128...). Calls onDetect once, then stops. */
export function BarcodeScanner({ onDetect }: { onDetect: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const done = useRef(false);
  const cb = useRef(onDetect);
  cb.current = onDetect;

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available here. Open MacroMeter over https (your Vercel link) or type the barcode below.');
      return;
    }

    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current!, (result) => {
        if (result && !done.current) {
          done.current = true;
          navigator.vibrate?.(60);
          controls?.stop();
          cb.current(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        if (cancelled) c.stop();
      })
      .catch((e: Error) => {
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access for this site, or type the barcode below.'
            : 'Could not start the camera. You can type the barcode below.',
        );
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="stack">
      {!error ? (
        <div className="scanner">
          <video ref={videoRef} muted playsInline />
          <div className="frame" />
          <div className="laser" />
        </div>
      ) : (
        <div className="callout warn">{error}</div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.replace(/\D/g, '');
          if (code.length >= 6) onDetect(code);
        }}
      >
        <input className="input grow num" inputMode="numeric" placeholder="Or type the barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <button className="icon-btn" style={{ width: 48, height: 48 }} aria-label="Look up barcode">
          <Icon name="search" />
        </button>
      </form>
    </div>
  );
}
