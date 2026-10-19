import { Suspense, lazy } from 'react';

// The barcode library is large, so it only loads when a scanner is opened.
const BarcodeScannerLazy = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })));

export function Scanner({ onDetect }: { onDetect: (code: string) => void }) {
  return (
    <Suspense fallback={<div className="scanner" />}>
      <BarcodeScannerLazy onDetect={onDetect} />
    </Suspense>
  );
}
