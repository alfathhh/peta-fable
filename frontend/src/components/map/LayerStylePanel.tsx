import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { layerApi } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { toast } from '../../stores/toastStore';
import type { LayerStyle, ProjectLayer } from '../../types';

/** Panel styling satu layer: outline/fill, warna, opasitas, tebal, label atribut. */
export function LayerStylePanel({
  layer,
  fields,
  onChange,
  onDelete,
}: {
  layer: ProjectLayer;
  fields: string[]; // nama properti geojson untuk pilihan label
  onChange: (updated: ProjectLayer) => void;
  onDelete: () => void;
}) {
  const [style, setStyle] = useState<LayerStyle>(layer.style);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setStyle(layer.style), [layer.style]);

  // simpan style ke server dengan debounce; perubahan live via onChange
  function apply(next: LayerStyle) {
    setStyle(next);
    onChange({ ...layer, style: next });
  }
  useEffect(() => {
    const t = setTimeout(() => {
      if (JSON.stringify(style) !== JSON.stringify(layer.style)) {
        layerApi.update(layer.id, { style }).catch((err) => toast.error(apiErrorMessage(err)));
      }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  async function toggleVisible() {
    try {
      const updated = await layerApi.update(layer.id, { is_visible: !layer.isVisible });
      onChange(updated);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => void toggleVisible()} className="text-gray-500 hover:text-blue-600" title="Tampil/sembunyi">
          {layer.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
        <button onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 truncate text-left text-sm font-medium">
          {layer.name} <span className="text-xs text-gray-400">({layer.featureCount} fitur)</span>
        </button>
        <button onClick={onDelete} className="text-gray-400 hover:text-red-600" title="Hapus layer">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="space-y-2 border-t px-3 py-2 text-sm">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={style.mode === 'outline'} onChange={() => apply({ ...style, mode: 'outline' })} />
              Outline
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={style.mode === 'fill'} onChange={() => apply({ ...style, mode: 'fill' })} />
              Fill
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              Warna garis
              <input type="color" value={style.strokeColor} onChange={(e) => apply({ ...style, strokeColor: e.target.value })} className="block h-8 w-full" />
            </label>
            <label className="text-xs">
              Tebal garis: {style.strokeWidth}px
              <input type="range" min={0} max={8} step={0.5} value={style.strokeWidth} onChange={(e) => apply({ ...style, strokeWidth: Number(e.target.value) })} className="block w-full" />
            </label>
            {style.mode === 'fill' && (
              <>
                <label className="text-xs">
                  Warna fill
                  <input type="color" value={style.fillColor} onChange={(e) => apply({ ...style, fillColor: e.target.value })} className="block h-8 w-full" />
                </label>
                <label className="text-xs">
                  Opasitas: {Math.round(style.fillOpacity * 100)}%
                  <input type="range" min={0} max={1} step={0.05} value={style.fillOpacity} onChange={(e) => apply({ ...style, fillOpacity: Number(e.target.value) })} className="block w-full" />
                </label>
              </>
            )}
          </div>
          <div className="border-t pt-2">
            <label className="text-xs font-medium">Label atribut</label>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              value={style.label?.field ?? ''}
              onChange={(e) =>
                apply({
                  ...style,
                  label: e.target.value
                    ? { field: e.target.value, fontSize: style.label?.fontSize ?? 12, fontColor: style.label?.fontColor ?? '#111827' }
                    : null,
                })
              }
            >
              <option value="">— Tanpa label —</option>
              {fields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            {style.label && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs">
                  Ukuran: {style.label.fontSize}px
                  <input type="range" min={8} max={24} value={style.label.fontSize} onChange={(e) => apply({ ...style, label: { ...style.label!, fontSize: Number(e.target.value) } })} className="block w-full" />
                </label>
                <label className="text-xs">
                  Warna font
                  <input type="color" value={style.label.fontColor} onChange={(e) => apply({ ...style, label: { ...style.label!, fontColor: e.target.value } })} className="block h-8 w-full" />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
