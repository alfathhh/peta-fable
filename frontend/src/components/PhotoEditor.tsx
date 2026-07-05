import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Button, Modal } from './ui';

/**
 * Editor foto ala ganti foto profil: geser untuk memposisikan, slider/pinch
 * untuk zoom, hasil dipotong 4:3 lalu diekspor JPEG via canvas.
 */
export function PhotoEditor({
  src,
  open,
  onClose,
  onDone,
}: {
  src: string | null;
  open: boolean;
  onClose: () => void;
  onDone: (file: File) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  async function exportCropped() {
    if (!src || !croppedArea) return;
    setBusy(true);
    try {
      const image = new Image();
      image.src = src;
      await new Promise((res, rej) => {
        image.onload = res;
        image.onerror = rej;
      });
      const canvas = document.createElement('canvas');
      // batasi keluaran maks 1600px (aturan foto PRD §7)
      const scale = Math.min(1, 1600 / croppedArea.width);
      canvas.width = Math.round(croppedArea.width * scale);
      canvas.height = Math.round(croppedArea.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        image,
        croppedArea.x,
        croppedArea.y,
        croppedArea.width,
        croppedArea.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('crop gagal'))), 'image/jpeg', 0.8),
      );
      onDone(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
      onClose();
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open && !!src} onClose={onClose} title="Atur Foto">
      <div className="space-y-3">
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-gray-900">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={4}
              aspect={4 / 3}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>
        <label className="block text-sm">
          Perbesar/perkecil
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 block w-full"
          />
        </label>
        <p className="text-xs text-gray-500">Geser foto untuk memposisikan, gunakan slider (atau cubit di HP) untuk zoom.</p>
        <div className="flex gap-2">
          <Button onClick={() => void exportCropped()} disabled={busy} className="flex-1">
            {busy ? 'Memproses...' : 'Pakai Foto Ini'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
