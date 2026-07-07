import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import L from 'leaflet';
import shp from 'shpjs';
import { ArrowLeft, Layers, Plus, Trash2, Upload, X, Pencil } from 'lucide-react';
import { MapContainer, useMap } from '../components/map/MapContainer';
import { CurrentLocation, type GpsPosition } from '../components/map/CurrentLocation';
import { UploadedLayer } from '../components/map/UploadedLayer';
import { LayerStylePanel } from '../components/map/LayerStylePanel';
import { InfraForm } from '../components/InfraForm';
import { categoryMarkerIcon } from '../components/map/markerIcon';
import { infraApi, layerApi, projectApi, regionApi } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { Button, LoadingState, Modal } from '../components/ui';
import { toast } from '../stores/toastStore';
import type { InfraDetail, InfraMarkerData, ProjectDetail as ProjectDetailT, ProjectLayer } from '../types';
import type { BasemapKey } from '../config/basemaps';
import { availableBasemaps, BASEMAPS } from '../config/basemaps';

/** Outline wilayah proyek + auto-zoom ke bbox. */
function ProjectRegionOutline({ project }: { project: ProjectDetailT }) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!map || !project.region) return;
    if (project.region.bbox) {
      const [minLng, minLat, maxLng, maxLat] = project.region.bbox;
      map.fitBounds(L.latLngBounds([minLat, minLng], [maxLat, maxLng]), { padding: [30, 30] });
    }
    regionApi
      .geojson(project.region.level, project.region.regionId, 'high')
      .then((fc) => {
        layerRef.current?.remove();
        layerRef.current = L.geoJSON(fc, {
          style: { color: '#b91c1c', weight: 3, fill: false, dashArray: '6 4' },
          interactive: false,
        }).addTo(map);
      })
      .catch(() => {});
    return () => {
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, [map, project]);

  return null;
}

/** Marker infrastruktur milik user pada proyek ini. */
function ProjectInfraMarkers({ items }: { items: InfraMarkerData[] }) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map) return;
    groupRef.current?.remove();
    const group = L.layerGroup(
      items.map((i) =>
        L.marker([i.lat, i.lng], { icon: categoryMarkerIcon(i.category.icon, i.category.color) }).bindTooltip(i.name),
      ),
    ).addTo(map);
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
    };
  }, [map, items]);

  return null;
}

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const [project, setProject] = useState<ProjectDetailT | null>(null);
  const [layers, setLayers] = useState<ProjectLayer[]>([]);
  const [layerFields, setLayerFields] = useState<Record<string, string[]>>({});
  const [infras, setInfras] = useState<InfraMarkerData[]>([]);
  const [gps, setGps] = useState<GpsPosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapKey>('street');
  const [panel, setPanel] = useState<'none' | 'layers' | 'infra'>('none');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InfraDetail | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadProject = useCallback(() => {
    projectApi
      .detail(id)
      .then((p) => {
        setProject(p);
        setLayers(p.layers);
      })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [id]);

  const loadInfras = useCallback(() => {
    infraApi
      .list({ project_id: id })
      .then(setInfras)
      .catch(() => setInfras([]));
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);
  useEffect(() => {
    loadInfras();
  }, [loadInfras]);

  // ambil daftar field properti tiap layer (untuk dropdown label)
  useEffect(() => {
    for (const layer of layers) {
      if (layerFields[layer.id]) continue;
      layerApi
        .geojson(layer.id)
        .then((fc) => {
          const first = fc.features[0]?.properties ?? {};
          setLayerFields((prev) => ({ ...prev, [layer.id]: Object.keys(first as object) }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  async function uploadLayer(file: File) {
    setUploading(true);
    try {
      let blob: Blob = file;
      let name = file.name;
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Shapefile -> GeoJSON di browser (shpjs), server tidak perlu GDAL
        const geojson = await shp(await file.arrayBuffer());
        const fc = Array.isArray(geojson) ? geojson[0] : geojson;
        blob = new Blob([JSON.stringify(fc)], { type: 'application/geo+json' });
        name = file.name.replace(/\.zip$/i, '.geojson');
      }
      const layer = await layerApi.upload(id, blob, name);
      setLayers((prev) => [...prev, layer]);
      toast.success('Layer ditambahkan');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function deleteLayer(layer: ProjectLayer) {
    if (!confirm(`Hapus layer "${layer.name}"?`)) return;
    try {
      await layerApi.remove(layer.id);
      setLayers((prev) => prev.filter((l) => l.id !== layer.id));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  const myInfras = useMemo(() => infras, [infras]);

  async function editInfra(infraId: string) {
    try {
      const d = await infraApi.detail(infraId);
      setEditing(d);
      setFormOpen(true);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function deleteInfra(infraId: string, name: string) {
    if (!confirm(`Hapus infrastruktur "${name}"?`)) return;
    try {
      await infraApi.remove(infraId);
      toast.success('Dihapus');
      loadInfras();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  if (!project) return <LoadingState text="Memuat proyek..." />;

  return (
    <div className="relative h-full">
      <MapContainer basemap={basemap}>
        <ProjectRegionOutline project={project} />
        <CurrentLocation onChange={setGps} onError={setGpsError} />
        {layers.map((layer) => (
          <UploadedLayer key={`${layer.id}-${JSON.stringify(layer.style)}-${layer.isVisible}`} layer={layer} />
        ))}
        <ProjectInfraMarkers items={myInfras} />
      </MapContainer>

      {/* header proyek */}
      <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-md">
        <Link to="/proyek" className="text-gray-500 hover:text-blue-600" title="Kembali">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="max-w-[50vw] truncate text-sm font-semibold">{project.name}</p>
          <p className="text-xs text-gray-500">
            {project.region?.name} - {project.activity?.name}
          </p>
        </div>
      </div>

      {/* kontrol kanan */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
          {availableBasemaps().map((key) => (
            <button
              key={key}
              onClick={() => setBasemap(key)}
              className={`px-3 py-2 text-xs font-medium ${basemap === key ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
            >
              {BASEMAPS[key].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPanel(panel === 'layers' ? 'none' : 'layers')}
          className="rounded-lg bg-white p-2.5 shadow-md hover:bg-gray-50"
          title="Layer proyek"
        >
          <Layers className="h-5 w-5 text-blue-600" />
        </button>
      </div>

      {/* tombol utama bawah */}
      <div className="absolute inset-x-0 bottom-5 z-[1000] flex justify-center gap-2 px-4">
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Infrastruktur
        </Button>
        <Button variant="secondary" onClick={() => setPanel(panel === 'infra' ? 'none' : 'infra')}>
          Infrastruktur Saya ({myInfras.length})
        </Button>
      </div>

      {/* panel layer */}
      {panel === 'layers' && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-3 sm:top-16 sm:bottom-auto sm:w-96 sm:rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Layer Proyek</h2>
            <button onClick={() => setPanel('none')} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-600 hover:bg-gray-50">
            <Upload className="h-4 w-4" />
            {uploading ? 'Mengunggah...' : 'Upload GeoJSON / Shapefile (.zip)'}
            <input
              type="file"
              accept=".geojson,.json,.zip"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLayer(f);
                e.target.value = '';
              }}
            />
          </label>
          <div className="space-y-2">
            {layers.map((layer) => (
              <LayerStylePanel
                key={layer.id}
                layer={layer}
                fields={layerFields[layer.id] ?? []}
                onChange={(updated) => setLayers((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
                onDelete={() => void deleteLayer(layer)}
              />
            ))}
            {layers.length === 0 && <p className="text-xs text-gray-500">Belum ada layer. Upload GeoJSON atau SHP (zip).</p>}
          </div>
        </div>
      )}

      {/* panel infrastruktur saya */}
      {panel === 'infra' && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-3 sm:top-16 sm:bottom-auto sm:w-96 sm:rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Infrastruktur Saya</h2>
            <button onClick={() => setPanel('none')} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="divide-y">
            {myInfras.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <span className="h-3 w-3 flex-none rounded-full" style={{ background: i.category.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.name}</p>
                  <p className="text-xs text-gray-500">
                    {i.category.name}
                    {i.isOutsideRegion && <span className="ml-1 text-amber-600">- di luar wilayah</span>}
                  </p>
                  {i.approvalStatus === 'rejected' && i.approvalNote && (
                    <p className="text-xs text-red-600">Alasan ditolak: {i.approvalNote}</p>
                  )}
                </div>
                <span
                  className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    i.approvalStatus === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : i.approvalStatus === 'rejected'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                  title={i.approvalStatus === 'rejected' && i.approvalNote ? `Alasan: ${i.approvalNote}` : undefined}
                >
                  {i.approvalStatus === 'approved' ? 'Di-ACC' : i.approvalStatus === 'rejected' ? 'Ditolak' : 'Menunggu ACC'}
                </span>
                <button onClick={() => void editInfra(i.id)} className="rounded p-1.5 text-gray-400 hover:text-blue-600" title="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => void deleteInfra(i.id, i.name)} className="rounded p-1.5 text-gray-400 hover:text-red-600" title="Hapus">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {myInfras.length === 0 && <p className="py-3 text-xs text-gray-500">Belum ada infrastruktur di proyek ini.</p>}
          </ul>
        </div>
      )}

      {/* form tambah/edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Infrastruktur' : 'Tambah Infrastruktur'}
      >
        <InfraForm
          projectId={id}
          gps={gps}
          gpsError={gpsError}
          existing={editing}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            loadInfras();
          }}
        />
      </Modal>
    </div>
  );
}
